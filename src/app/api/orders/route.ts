import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketPrice } from "@/lib/market-price";

const UNREALISTIC_LIMIT = 0.5;

function resolveAssetType(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith("=X")) return "forex";
  if (s.startsWith("^")) return "index";
  if (s.endsWith("=F")) return "commodity";
  return "stock";
}

function isMarketOpen(assetType: string): { open: boolean; reason: string } {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcTotalMins = utcHour * 60 + utcMin;

  if (assetType === "crypto") {
    return { open: true, reason: "" };
  }

  if (assetType === "forex") {
    // Forex: Sun 5pm ET (22:00 UTC) to Fri 5pm ET (22:00 UTC)
    if (utcDay === 6) return { open: false, reason: "Forex market is closed on Saturday. Opens Sunday evening." };
    if (utcDay === 0 && utcTotalMins < 22 * 60)
      return { open: false, reason: "Forex market opens Sunday 5:00 PM ET." };
    if (utcDay === 5 && utcTotalMins >= 22 * 60)
      return { open: false, reason: "Forex market is closed. Opens Sunday 5:00 PM ET." };
    return { open: true, reason: "" };
  }

  // US stocks, indexes, commodities: Mon-Fri 9:30 AM – 4:00 PM ET
  // ET = UTC-4 (EDT) or UTC-5 (EST). Approximate with UTC-4.
  const etOffsetMins = 4 * 60;
  const etMins = ((utcTotalMins - etOffsetMins) + 1440) % 1440;

  if (utcDay === 0 || utcDay === 6) {
    return { open: false, reason: "Market is closed on weekends. Opens Monday 9:30 AM ET." };
  }

  const openMins = 9 * 60 + 30;   // 9:30 AM
  const closeMins = 16 * 60;       // 4:00 PM

  if (etMins < openMins) {
    return { open: false, reason: "Market opens at 9:30 AM ET (pre-market)." };
  }
  if (etMins >= closeMins) {
    return { open: false, reason: "Market is closed (after hours). Opens 9:30 AM ET." };
  }

  return { open: true, reason: "" };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { symbol, side, order_type, quantity, limit_price, stop_price } = body;

    if (!symbol || !side || !order_type || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }

    if (!["limit", "stop", "stop-limit"].includes(order_type)) {
      return NextResponse.json({ error: "Only limit/stop/stop-limit orders supported" }, { status: 400 });
    }

    // Permission check
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_locked, can_trade_crypto, can_trade_stocks, can_trade_indexes, can_trade_commodities, can_trade_forex, can_trade_options")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (profile.is_locked) {
      return NextResponse.json(
        { error: "Your account has been locked. Contact support." },
        { status: 403 }
      );
    }

    const assetType = resolveAssetType(symbol);
    const permMap: Record<string, string> = {
      crypto: "can_trade_crypto",
      stock: "can_trade_stocks",
      index: "can_trade_indexes",
      commodity: "can_trade_commodities",
      forex: "can_trade_forex",
    };
    const permField = permMap[assetType];
    if (permField && profile[permField as keyof typeof profile] === false) {
      const label = assetType.charAt(0).toUpperCase() + assetType.slice(1);
      return NextResponse.json(
        { error: `${label} trading is not enabled on your account. Contact your account manager.` },
        { status: 403 }
      );
    }

    // Market hours check
    const { open, reason } = isMarketOpen(assetType);
    if (!open) {
      return NextResponse.json(
        { error: reason },
        { status: 400 }
      );
    }

    const limitPrice = order_type === "limit" || order_type === "stop-limit" ? limit_price : null;
    const stopPrice = order_type === "stop" || order_type === "stop-limit" ? stop_price : null;
    const priceToCheck = limitPrice ?? stopPrice;

    if (priceToCheck != null) {
      const marketPrice = await fetchMarketPrice(symbol);
      if (marketPrice && marketPrice > 0) {
        const ratio = parseFloat(priceToCheck) / marketPrice;
        if (side === "buy" && ratio < UNREALISTIC_LIMIT) {
          return NextResponse.json(
            { error: "Limit price too low. Adjust closer to market or use market order." },
            { status: 400 }
          );
        }
        if (side === "sell" && ratio > 1 / UNREALISTIC_LIMIT) {
          return NextResponse.json(
            { error: "Limit price too high. Adjust closer to market or use market order." },
            { status: 400 }
          );
        }
      }
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        symbol,
        side,
        order_type,
        quantity: parseFloat(quantity),
        limit_price: limitPrice ? parseFloat(limitPrice) : null,
        stop_price: stopPrice ? parseFloat(stopPrice) : null,
        status: "open",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
