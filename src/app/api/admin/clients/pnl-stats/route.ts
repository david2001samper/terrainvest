import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EPSILON = 1e-8;

interface ClientPnlStats {
  userId: string;
  email: string;
  displayName: string | null;
  balance: number;
  totalPnl: number;
  todayPnl: number;
  todayTrades: number;
  totalTrades: number;
  totalWins: number;
  winRate: number;
}

function todayDateString(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
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

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, display_name, balance, total_pnl")
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    const { data: allTrades, error: tradesError } = await supabase
      .from("trades")
      .select("user_id, profit_loss, created_at")
      .eq("status", "filled");

    if (tradesError) throw tradesError;

    const todayStr = todayDateString();

    const tradesByUser = new Map<
      string,
      { totalPnl: number; todayPnl: number; todayTrades: number; totalTrades: number; totalWins: number }
    >();

    for (const trade of allTrades || []) {
      const pnl = Number(trade.profit_loss) || 0;
      if (Math.abs(pnl) <= EPSILON) continue;

      const userId = trade.user_id;
      const tradeDate = trade.created_at?.slice(0, 10);
      const isToday = tradeDate === todayStr;

      const stats = tradesByUser.get(userId) || {
        totalPnl: 0,
        todayPnl: 0,
        todayTrades: 0,
        totalTrades: 0,
        totalWins: 0,
      };

      stats.totalPnl += pnl;
      stats.totalTrades += 1;
      if (pnl > EPSILON) stats.totalWins += 1;

      if (isToday) {
        stats.todayPnl += pnl;
        stats.todayTrades += 1;
      }

      tradesByUser.set(userId, stats);
    }

    const results: ClientPnlStats[] = (profiles || []).map((p) => {
      const stats = tradesByUser.get(p.id) || {
        totalPnl: 0,
        todayPnl: 0,
        todayTrades: 0,
        totalTrades: 0,
        totalWins: 0,
      };

      return {
        userId: p.id,
        email: p.email,
        displayName: p.display_name,
        balance: p.balance || 0,
        totalPnl: stats.totalPnl,
        todayPnl: stats.todayPnl,
        todayTrades: stats.todayTrades,
        totalTrades: stats.totalTrades,
        totalWins: stats.totalWins,
        winRate: stats.totalTrades > 0 ? (stats.totalWins / stats.totalTrades) * 100 : 0,
      };
    });

    results.sort((a, b) => b.totalPnl - a.totalPnl);

    const summary = {
      totalClients: results.length,
      clientsWithTrades: results.filter((r) => r.totalTrades > 0).length,
      platformTotalPnl: results.reduce((sum, r) => sum + r.totalPnl, 0),
      platformTodayPnl: results.reduce((sum, r) => sum + r.todayPnl, 0),
      platformTotalTrades: results.reduce((sum, r) => sum + r.totalTrades, 0),
      platformTodayTrades: results.reduce((sum, r) => sum + r.todayTrades, 0),
    };

    return NextResponse.json({ clients: results, summary });
  } catch (error) {
    console.error("Admin PnL stats error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
