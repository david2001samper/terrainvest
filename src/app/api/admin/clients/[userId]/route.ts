import { NextResponse } from "next/server";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await params;

    const [{ data, error }, { data: trades, error: tradesError }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single(),
      supabase
        .from("trades")
        .select("profit_loss")
        .eq("user_id", userId)
        .eq("status", "filled"),
    ]);

    if (error || !data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (tradesError) throw tradesError;

    const tradeRealizedPnl = (trades ?? []).reduce(
      (sum, trade) => sum + (Number(trade.profit_loss) || 0),
      0
    );
    const storedPnl = Number(data.total_pnl) || 0;

    return NextResponse.json({
      ...data,
      trade_realized_pnl: tradeRealizedPnl,
      pnl_discrepancy: storedPnl - tradeRealizedPnl,
    });
  } catch (error) {
    console.error("Client fetch error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await params;
    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select("profit_loss")
      .eq("user_id", userId)
      .eq("status", "filled");

    if (tradesError) throw tradesError;

    const tradeRealizedPnl = (trades ?? []).reduce(
      (sum, trade) => sum + (Number(trade.profit_loss) || 0),
      0
    );

    const service = await createServiceClient();
    const { data, error } = await service
      .from("profiles")
      .update({
        total_pnl: tradeRealizedPnl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: data,
      trade_realized_pnl: tradeRealizedPnl,
      pnl_discrepancy: 0,
    });
  } catch (error) {
    console.error("Client P&L sync error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
