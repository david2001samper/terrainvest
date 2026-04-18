import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface DayPnl {
  date: string;
  pnl: number;
  cumulative: number;
}

interface SymbolBreakdown {
  symbol: string;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
}

const MAX_TZ_OFFSET_MINUTES = 14 * 60;
const EPSILON = 1e-8;

function parseTzOffsetMinutes(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const rounded = Math.trunc(parsed);
  if (rounded < -MAX_TZ_OFFSET_MINUTES || rounded > MAX_TZ_OFFSET_MINUTES) return 0;
  return rounded;
}

function dayKeyForInstant(date: Date, tzOffsetMinutes: number): string {
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return "1970-01-01";
  const shifted = new Date(ms - tzOffsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const tzOffsetMinutes = parseTzOffsetMinutes(
      searchParams.get("tzOffsetMinutes")
    );

    const { data: trades, error } = await supabase
      .from("trades")
      .select("symbol, side, quantity, price, profit_loss, created_at")
      .eq("user_id", user.id)
      .eq("status", "filled")
      .order("created_at", { ascending: true });

    if (error) throw error;
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("total_pnl")
      .eq("id", user.id)
      .single();

    const rows = trades || [];
    const profileTotalPnl = Number(profileRow?.total_pnl);
    const realizedRows = rows.filter((t) => {
      const pnl = Number(t.profit_loss) || 0;
      return t.side === "sell" || Math.abs(pnl) > EPSILON;
    });

    const dailyMap = new Map<string, number>();
    const symbolMap = new Map<
      string,
      { pnl: number; count: number; wins: number }
    >();

    for (const t of realizedRows) {
      const pnl = Number(t.profit_loss) || 0;
      const day = dayKeyForInstant(new Date(t.created_at), tzOffsetMinutes);

      dailyMap.set(day, (dailyMap.get(day) || 0) + pnl);

      const sym = t.symbol;
      const existing = symbolMap.get(sym) || { pnl: 0, count: 0, wins: 0 };
      existing.pnl += pnl;
      existing.count += 1;
      if (pnl > 0) existing.wins += 1;
      symbolMap.set(sym, existing);
    }

    const dailyPnl: DayPnl[] = [];
    const totalPnlFromTrades = Array.from(dailyMap.values()).reduce(
      (sum, pnl) => sum + pnl,
      0
    );
    const carryAdjustment = Number.isFinite(profileTotalPnl)
      ? profileTotalPnl - totalPnlFromTrades
      : 0;
    let cumulative = carryAdjustment;
    const sortedDays = Array.from(dailyMap.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    for (const [date, pnl] of sortedDays) {
      cumulative += pnl;
      dailyPnl.push({ date, pnl, cumulative });
    }

    const todayStr = dayKeyForInstant(new Date(), tzOffsetMinutes);
    const todayPnl = dailyMap.get(todayStr) || 0;
    const totalPnl = Number.isFinite(profileTotalPnl)
      ? profileTotalPnl
      : totalPnlFromTrades;
    const totalTrades = realizedRows.length;
    const totalWins = realizedRows.filter(
      (t) => (Number(t.profit_loss) || 0) > EPSILON
    ).length;
    const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

    const symbols: SymbolBreakdown[] = Array.from(symbolMap.entries())
      .map(([symbol, data]) => ({
        symbol,
        totalPnl: data.pnl,
        tradeCount: data.count,
        wins: data.wins,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl);

    return NextResponse.json({
      dailyPnl,
      todayPnl,
      totalPnl,
      winRate,
      totalTrades,
      symbols,
    });
  } catch (error) {
    console.error("PnL API error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
