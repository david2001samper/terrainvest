import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketPrice } from "@/lib/market-price";

const UNREALISTIC_LIMIT = 0.5;

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
