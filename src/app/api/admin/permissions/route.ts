import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PERM_FIELDS = [
  "can_trade_crypto",
  "can_trade_stocks",
  "can_trade_indexes",
  "can_trade_commodities",
  "can_trade_forex",
  "can_trade_options",
  "can_view_order_book",
  "max_leverage",
] as const;

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    if (!admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    let query = supabase
      .from("profiles")
      .select(
        "id, email, display_name, role, can_trade_crypto, can_trade_stocks, can_trade_indexes, can_trade_commodities, can_trade_forex, can_trade_options, can_view_order_book, max_leverage"
      )
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,display_name.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ clients: data ?? [] });
  } catch (e) {
    console.error("Admin permissions GET:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of PERM_FIELDS) {
      if (body[field] !== undefined) {
        updates[field] =
          field === "max_leverage"
            ? Math.max(1, Math.min(200, parseInt(String(body[field])) || 1))
            : Boolean(body[field]);
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin permissions PATCH:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
