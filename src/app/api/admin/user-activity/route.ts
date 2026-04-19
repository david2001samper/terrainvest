import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

    const service = await createServiceClient();

    const [profileRes, tradesRes, logsRes, authUserRes] = await Promise.all([
      supabase.from("profiles").select("last_login_at").eq("id", userId).single(),
      supabase.from("trades").select("total, quantity, price").eq("user_id", userId),
      supabase
        .from("login_logs")
        .select("created_at, ip, user_agent")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      // Auth's last_sign_in_at is the definitive login timestamp — Supabase
      // updates it on every signInWithPassword regardless of RLS.
      service.auth.admin.getUserById(userId),
    ]);

    const profile  = profileRes.data;
    const trades   = tradesRes.data ?? [];
    const logs     = logsRes.data ?? [];
    const authUser = authUserRes.data?.user ?? null;

    const tradeCount    = trades.length;
    const totalVolume   = trades.reduce((s, t) => s + (t.total || 0), 0);
    const avgTradeSize  = tradeCount > 0 ? totalVolume / tradeCount : 0;

    // Pick the most recent timestamp across all sources.
    const candidates = [
      authUser?.last_sign_in_at ?? null,
      profile?.last_login_at ?? null,
      logs[0]?.created_at ?? null,
    ].filter(Boolean) as string[];
    const bestLastLogin = candidates.length
      ? candidates.reduce((a, b) => (a > b ? a : b))
      : null;

    return NextResponse.json({
      last_login_at: bestLastLogin,
      auth_last_sign_in_at: authUser?.last_sign_in_at ?? null,
      recent_logins: logs.map((l: { created_at: string; ip?: string | null; user_agent?: string | null }) => ({
        at: l.created_at,
        ip: l.ip ?? null,
        ua: l.user_agent ?? null,
      })),
      trade_count: tradeCount,
      total_volume: totalVolume,
      avg_trade_size: avgTradeSize,
    });
  } catch (error) {
    console.error("User activity error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
