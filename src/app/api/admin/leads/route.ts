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
    const email = searchParams.get("email") || "";
    const country_code = searchParams.get("country_code") || "";
    const date_from = searchParams.get("date_from") || "";
    const date_to = searchParams.get("date_to") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 50;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (email) {
      query = query.ilike("email", `%${email}%`);
    }
    if (country_code) {
      query = query.ilike("country_code", `%${country_code}%`);
    }
    if (date_from) {
      query = query.gte("created_at", new Date(date_from).toISOString());
    }
    if (date_to) {
      const end = new Date(date_to);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      leads: data ?? [],
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    console.error("Admin leads error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
