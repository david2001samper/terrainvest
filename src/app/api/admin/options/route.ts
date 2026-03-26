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

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { position_id, status, realized_pnl } = body;

    if (!position_id || !status)
      return NextResponse.json({ error: "position_id and status required" }, { status: 400 });

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (realized_pnl !== undefined) updates.realized_pnl = realized_pnl;

    const { error } = await supabase
      .from("options_positions")
      .update(updates)
      .eq("id", position_id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin options PATCH:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
