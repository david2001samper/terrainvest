import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tradeSchema } from "@/lib/validations";
import { fetchMarketPrice } from "@/lib/market-price";

const UNREALISTIC_THRESHOLD = 0.15;
const SLIPPAGE_MAX = 0.003;
const DELAY_MIN_MS = 1000;
const DELAY_MAX_MS = 5000;

function randomDelay() {
  const ms = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = tradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { symbol, side, quantity, price: userPrice } = parsed.data;

    const [feeRow, marketPrice] = await Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "fee_per_trade").single(),
      fetchMarketPrice(symbol),
    ]);

    const fee = parseFloat(feeRow?.data?.value ?? "0.10");
    const price = marketPrice ?? userPrice;

    const priceDiff = Math.abs(userPrice - price) / (price || 1);
    if (priceDiff > UNREALISTIC_THRESHOLD) {
      return NextResponse.json(
        {
          error: "Order rejected",
          message: "Price moved significantly. Please refresh and try again.",
          pending: true,
        },
        { status: 400 }
      );
    }

    const slippage = 1 + (Math.random() * 2 - 1) * SLIPPAGE_MAX;
    const execPrice = price * slippage;
    const total = quantity * execPrice;

    await randomDelay();

    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const totalWithFee = side === "buy" ? total + fee : total - fee;
    if (side === "buy" && profile.balance < totalWithFee) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    if (side === "sell") {
      const { data: position } = await supabase
        .from("positions")
        .select("quantity")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      if (!position || position.quantity < quantity) {
        return NextResponse.json(
          { error: "Insufficient position" },
          { status: 400 }
        );
      }
    }

    const { error: tradeError } = await supabase.from("trades").insert({
      user_id: user.id,
      symbol,
      side,
      quantity,
      price: execPrice,
      total,
      status: "filled",
    });

    if (tradeError) {
      return NextResponse.json({ error: tradeError.message }, { status: 500 });
    }

    if (side === "buy") {
      await supabase
        .from("profiles")
        .update({ balance: profile.balance - total - fee })
        .eq("id", user.id);

      const { data: existingPos } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      if (existingPos) {
        const newQty = existingPos.quantity + quantity;
        const newAvgPrice =
          (existingPos.entry_price * existingPos.quantity + execPrice * quantity) /
          newQty;
        await supabase
          .from("positions")
          .update({
            quantity: newQty,
            entry_price: newAvgPrice,
            current_value: newQty * execPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPos.id);
      } else {
        await supabase.from("positions").insert({
          user_id: user.id,
          symbol,
          quantity,
          entry_price: execPrice,
          current_value: quantity * execPrice,
        });
      }
    } else {
      await supabase
        .from("profiles")
        .update({ balance: profile.balance + total - fee })
        .eq("id", user.id);

      const { data: position } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("symbol", symbol)
        .single();

      if (position) {
        const newQty = position.quantity - quantity;
        const pnl = (execPrice - position.entry_price) * quantity;

        if (newQty <= 0.00000001) {
          await supabase.from("positions").delete().eq("id", position.id);
        } else {
          await supabase
            .from("positions")
            .update({
              quantity: newQty,
              current_value: newQty * execPrice,
              updated_at: new Date().toISOString(),
            })
            .eq("id", position.id);
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("total_pnl")
          .eq("id", user.id)
          .single();
        if (prof) {
          await supabase
            .from("profiles")
            .update({ total_pnl: prof.total_pnl + pnl })
            .eq("id", user.id);
        }
      }
    }

    return NextResponse.json({ success: true, message: `${side.toUpperCase()} order executed` });
  } catch (error) {
    console.error("Trade error:", error);
    return NextResponse.json({ error: "Trade execution failed" }, { status: 500 });
  }
}
