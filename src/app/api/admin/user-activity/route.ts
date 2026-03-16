import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const [profileRes, tradesRes, logsRes] = await Promise.all([
      supabase.from("profiles").select("last_login_at").eq("id", userId).single(),
      supabase.from("trades").select("total, quantity, price").eq("user_id", userId),
      supabase
        .from("login_logs")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const profile = profileRes.data;
    const trades = tradesRes.data ?? [];
    const logs = logsRes.data ?? [];
    const tradeCount = trades.length;
    const totalVolume = trades.reduce((s, t) => s + (t.total || 0), 0);
    const avgTradeSize = tradeCount > 0 ? totalVolume / tradeCount : 0;

    return NextResponse.json({
      last_login_at: profile?.last_login_at ?? null,
      recent_logins: logs.map((l: { created_at: string }) => l.created_at),
      trade_count: tradeCount,
      total_volume: totalVolume,
      avg_trade_size: avgTradeSize,
    });
  } catch (error) {
    console.error("User activity error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
