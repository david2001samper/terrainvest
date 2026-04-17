import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isMarketOpen } from "@/lib/market-hours";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const {
      action,
      contract_symbol,
      underlying_symbol,
      option_type,
      strike,
      expiry,
      quantity,
      premium,
      position_id,
    } = body;

    function normalizeExpiry(value: unknown): string | null {
      if (!value) return null;
      // If it's already an ISO-like string, validate it directly.
      if (typeof value === "string" && value.includes("-")) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
      }
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return null;
      const ms = n > 1e12 ? n : n * 1000;
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    }

    if (!action || !["buy", "sell"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("balance, is_locked, can_trade_options")
      .eq("id", user.id)
      .single();

    if (!profile)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (profile.is_locked)
      return NextResponse.json({ error: "Account locked" }, { status: 403 });
    if (!profile.can_trade_options)
      return NextResponse.json(
        { error: "Options trading is not enabled on your account. Contact your account manager." },
        { status: 403 }
      );

    const CONTRACT_SIZE = 100;

    // Market hours: options are treated as US session hours (same as stocks)
    const hours = isMarketOpen("stock");
    if (!hours.open) {
      return NextResponse.json({ error: hours.reason || "Market is closed." }, { status: 400 });
    }

    if (action === "buy") {
      const normalizedExpiry = normalizeExpiry(expiry);
      if (
        !contract_symbol ||
        !underlying_symbol ||
        !option_type ||
        strike == null ||
        !normalizedExpiry ||
        !quantity ||
        premium == null
      ) {
        return NextResponse.json({ error: "Missing or invalid fields (expiry)" }, { status: 400 });
      }

      const totalCost = premium * quantity * CONTRACT_SIZE;

      if (profile.balance < totalCost) {
        return NextResponse.json(
          { error: "Insufficient balance" },
          { status: 400 }
        );
      }

      const { error: balErr } = await supabase
        .from("profiles")
        .update({ balance: profile.balance - totalCost })
        .eq("id", user.id);
      if (balErr) {
        return NextResponse.json({ error: balErr.message }, { status: 500 });
      }

      const { data: existing } = await supabase
        .from("options_positions")
        .select("*")
        .eq("user_id", user.id)
        .eq("contract_symbol", contract_symbol)
        .eq("status", "open")
        .single();

      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvgPremium =
          (existing.entry_premium * existing.quantity +
            premium * quantity) /
          newQty;
        const { error: upErr } = await supabase
          .from("options_positions")
          .update({
            quantity: newQty,
            entry_premium: newAvgPremium,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (upErr) {
          // try to refund on failure
          await supabase.from("profiles").update({ balance: profile.balance }).eq("id", user.id);
          return NextResponse.json(
            { error: "Failed to update options position. Please try again." },
            { status: 500 }
          );
        }
      } else {
        const { error: insErr } = await supabase.from("options_positions").insert({
          user_id: user.id,
          contract_symbol,
          underlying_symbol,
          option_type,
          strike,
          expiry: normalizedExpiry,
          quantity,
          entry_premium: premium,
          current_premium: premium,
          status: "open",
        });
        if (insErr) {
          // try to refund on failure
          await supabase.from("profiles").update({ balance: profile.balance }).eq("id", user.id);
          console.error("Options insert error:", insErr);
          return NextResponse.json(
            {
              error: "Failed to create options position",
              details: insErr.message,
              code: insErr.code,
            },
            { status: 500 }
          );
        }
      }

      const { error: tradeErr } = await supabase.from("trades").insert({
        user_id: user.id,
        symbol: contract_symbol,
        side: "buy",
        quantity,
        price: premium,
        total: totalCost,
        profit_loss: 0,
        status: "filled",
      });
      if (tradeErr) {
        return NextResponse.json({ error: tradeErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Bought ${quantity} ${contract_symbol} contract(s)`,
      });
    }

    // SELL (close position)
    if (!position_id)
      return NextResponse.json({ error: "position_id required" }, { status: 400 });

    const sellQty = quantity || 0;

    const { data: position } = await supabase
      .from("options_positions")
      .select("*")
      .eq("id", position_id)
      .eq("user_id", user.id)
      .eq("status", "open")
      .single();

    if (!position)
      return NextResponse.json({ error: "Position not found" }, { status: 404 });

    const closePremium = premium ?? position.current_premium ?? position.entry_premium;
    const qtyToSell = sellQty > 0 ? Math.min(sellQty, position.quantity) : position.quantity;
    const proceeds = closePremium * qtyToSell * CONTRACT_SIZE;
    const realizedPnl = (closePremium - position.entry_premium) * qtyToSell * CONTRACT_SIZE;
    const remainingQty = position.quantity - qtyToSell;

    const { error: creditErr } = await supabase
      .from("profiles")
      .update({ balance: profile.balance + proceeds })
      .eq("id", user.id);
    if (creditErr) {
      return NextResponse.json({ error: creditErr.message }, { status: 500 });
    }

    if (remainingQty <= 0) {
      const { error: closeErr } = await supabase
        .from("options_positions")
        .update({
          status: "closed",
          closed_premium: closePremium,
          realized_pnl: realizedPnl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", position.id);
      if (closeErr) return NextResponse.json({ error: closeErr.message }, { status: 500 });
    } else {
      const { error: remErr } = await supabase
        .from("options_positions")
        .update({
          quantity: remainingQty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", position.id);
      if (remErr) return NextResponse.json({ error: remErr.message }, { status: 500 });
    }

    const { error: sellTradeErr } = await supabase.from("trades").insert({
      user_id: user.id,
      symbol: position.contract_symbol,
      side: "sell",
      quantity: qtyToSell,
      price: closePremium,
      total: proceeds,
      profit_loss: realizedPnl,
      status: "filled",
    });
    if (sellTradeErr) return NextResponse.json({ error: sellTradeErr.message }, { status: 500 });

    const { data: prof } = await supabase
      .from("profiles")
      .select("total_pnl")
      .eq("id", user.id)
      .single();
    if (prof) {
      await supabase
        .from("profiles")
        .update({ total_pnl: prof.total_pnl + realizedPnl })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      message: `Sold ${qtyToSell} ${position.contract_symbol} contract(s)`,
      realized_pnl: realizedPnl,
    });
  } catch (error) {
    console.error("Options trade error:", error);
    return NextResponse.json(
      { error: "Options trade failed" },
      { status: 500 }
    );
  }
}
