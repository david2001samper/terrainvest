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

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: trades, error } = await supabase
      .from("trades")
      .select("symbol, side, quantity, price, profit_loss, created_at")
      .eq("user_id", user.id)
      .eq("status", "filled")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = trades || [];

    const dailyMap = new Map<string, number>();
    const symbolMap = new Map<
      string,
      { pnl: number; count: number; wins: number }
    >();

    for (const t of rows) {
      const pnl = Number(t.profit_loss) || 0;
      const day = new Date(t.created_at).toISOString().split("T")[0];

      dailyMap.set(day, (dailyMap.get(day) || 0) + pnl);

      const sym = t.symbol;
      const existing = symbolMap.get(sym) || { pnl: 0, count: 0, wins: 0 };
      existing.pnl += pnl;
      existing.count += 1;
      if (pnl > 0) existing.wins += 1;
      symbolMap.set(sym, existing);
    }

    const dailyPnl: DayPnl[] = [];
    let cumulative = 0;
    const sortedDays = Array.from(dailyMap.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    for (const [date, pnl] of sortedDays) {
      cumulative += pnl;
      dailyPnl.push({ date, pnl, cumulative });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const todayPnl = dailyMap.get(todayStr) || 0;
    const totalPnl = cumulative;
    const totalTrades = rows.length;
    const totalWins = rows.filter((t) => (Number(t.profit_loss) || 0) > 0).length;
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
