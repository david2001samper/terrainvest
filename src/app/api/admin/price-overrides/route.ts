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

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("price_overrides")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Price overrides error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { symbol, override_price, duration_seconds } = body;

    if (!symbol || override_price == null || override_price < 0) {
      return NextResponse.json({ error: "symbol and override_price required" }, { status: 400 });
    }

    const secs = Math.max(1, Math.min(3600, parseInt(String(duration_seconds ?? 30)) || 30));
    const expiresAt = new Date(Date.now() + secs * 1000);

    const { data, error } = await supabase
      .from("price_overrides")
      .upsert(
        {
          symbol: String(symbol).toUpperCase(),
          override_price: parseFloat(String(override_price)),
          expires_at: expiresAt.toISOString(),
          created_by: admin.id,
        },
        { onConflict: "symbol" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({
      ...data,
      duration_seconds: secs,
      expires_in: secs,
    });
  } catch (error) {
    console.error("Price override error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json({ error: "symbol required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("price_overrides")
      .delete()
      .eq("symbol", symbol.toUpperCase());

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete override error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
