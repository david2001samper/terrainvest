import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [
      { count: totalClients },
      { count: totalTrades },
      { data: trades },
      { data: profiles },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("trades").select("*", { count: "exact", head: true }),
      supabase.from("trades").select("total"),
      supabase.from("profiles").select("balance, total_pnl"),
    ]);

    const totalVolume = trades?.reduce((sum, t) => sum + (t.total || 0), 0) || 0;
    const totalBalances = profiles?.reduce((sum, p) => sum + (p.balance || 0), 0) || 0;
    const totalPnl = profiles?.reduce((sum, p) => sum + (p.total_pnl || 0), 0) || 0;

    return NextResponse.json({
      totalClients: totalClients || 0,
      totalTrades: totalTrades || 0,
      totalVolume,
      totalBalances,
      totalPnl,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
