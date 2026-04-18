import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchMarketPrice } from "@/lib/market-price";
import { isMarketOpen, resolveAssetTypeFromSymbol } from "@/lib/market-hours";
import { processOpenOrders } from "@/lib/orders/processor";

const UNREALISTIC_LIMIT = 0.5;
const CRYPTO_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "ADA",
  "DOGE",
  "DOT",
  "AVAX",
  "MATIC",
  "LINK",
]);

function resolveAssetType(symbol: string, clientHint: unknown): string {
  if (
    typeof clientHint === "string" &&
    ["crypto", "stock", "index", "commodity", "forex"].includes(clientHint)
  ) {
    return clientHint;
  }
  if (CRYPTO_SYMBOLS.has(symbol.toUpperCase())) return "crypto";
  return resolveAssetTypeFromSymbol(symbol);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Best-effort matching pass so pending orders can fill automatically
    // without requiring a separate scheduler in smaller deployments.
    try {
      const service = await createServiceClient();
      await processOpenOrders(service, { userId: user.id, maxOrders: 100 });
    } catch {
      // Do not fail orders list when processing pass errors.
    }

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

    const body = (await request.json()) as {
      symbol?: unknown;
      side?: unknown;
      order_type?: unknown;
      quantity?: unknown;
      limit_price?: unknown;
      stop_price?: unknown;
      asset_type?: unknown;
    };
    const symbol =
      typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
    const side = body.side;
    const orderType = body.order_type;
    const quantity = Number(body.quantity);

    if (!symbol || !side || !orderType || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }

    if (!["buy", "sell"].includes(String(side))) {
      return NextResponse.json({ error: "Invalid side" }, { status: 400 });
    }

    if (!["limit", "stop", "stop-limit"].includes(String(orderType))) {
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

    const assetType = resolveAssetType(symbol, body.asset_type);
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
        { error: reason || "Market is closed." },
        { status: 400 }
      );
    }

    const limitPrice = orderType === "limit" || orderType === "stop-limit"
      ? Number(body.limit_price)
      : null;
    const stopPrice = orderType === "stop" || orderType === "stop-limit"
      ? Number(body.stop_price)
      : null;
    const hasValidLimit = limitPrice != null && Number.isFinite(limitPrice) && limitPrice > 0;
    const hasValidStop = stopPrice != null && Number.isFinite(stopPrice) && stopPrice > 0;
    if ((orderType === "limit" || orderType === "stop-limit") && !hasValidLimit) {
      return NextResponse.json({ error: "Limit price must be greater than 0" }, { status: 400 });
    }
    if ((orderType === "stop" || orderType === "stop-limit") && !hasValidStop) {
      return NextResponse.json({ error: "Stop price must be greater than 0" }, { status: 400 });
    }

    const priceToCheck = limitPrice ?? stopPrice;

    if (priceToCheck != null) {
      const marketPrice = await fetchMarketPrice(symbol, assetType);
      if (marketPrice && marketPrice > 0) {
        const ratio = priceToCheck / marketPrice;
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
        order_type: orderType,
        quantity,
        limit_price: hasValidLimit ? limitPrice : null,
        stop_price: hasValidStop ? stopPrice : null,
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
