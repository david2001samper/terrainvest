import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { midToBidAsk } from "@/lib/forex/pricing";
import { convertToUSD } from "@/lib/forex/convert";
import { computeSwapDeltaUsd } from "@/lib/forex/swap";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: positions, error } = await supabase
      .from("forex_positions")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const out = await Promise.all(
      (positions ?? []).map(async (p) => {
        const mid = Number(p.last_mid ?? 0);
        const pipSize = Number(p.pip_size ?? 0.0001);
        const bidAsk = midToBidAsk({
          instrument: { pipSize, typicalSpreadPips: (p.quote as string) === "JPY" ? 1.4 : 1.1 },
          mid: mid > 0 ? mid : Number(p.avg_entry_price ?? 0),
          changePercent24h: null,
        });

        const unitsSigned = Number(p.units_signed ?? 0);
        const avgEntry = Number(p.avg_entry_price ?? 0);
        const mark = unitsSigned >= 0 ? bidAsk.bid : bidAsk.ask;
        const unrealQuote = (mark - avgEntry) * unitsSigned;
        const unrealUsd = await convertToUSD(String(p.quote), unrealQuote);

        const notionalQuote = Math.abs(unitsSigned) * bidAsk.mid;
        const notionalUsd = await convertToUSD(String(p.quote), notionalQuote);
        const marginUsed = Number(p.margin_used_usd ?? 0);

        const swap = computeSwapDeltaUsd({
          instrument: { swapLongBps: -2.0, swapShortBps: -2.0 },
          notionalUsd,
          unitsSigned,
          lastSwapAt: (p.last_swap_at as string | null) ?? null,
          now: new Date(),
        });

        return {
          ...p,
          mid: bidAsk.mid,
          bid: bidAsk.bid,
          ask: bidAsk.ask,
          spreadPips: bidAsk.spreadPips,
          mark,
          unrealized_pnl_usd: unrealUsd,
          margin_used_usd: marginUsed,
          swap_delta_usd: swap.deltaUsd,
        };
      })
    );

    return NextResponse.json(out);
  } catch (e) {
    console.error("Forex positions error:", e);
    return NextResponse.json([], { status: 500 });
  }
}

