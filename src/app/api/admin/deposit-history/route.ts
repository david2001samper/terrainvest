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
    const search   = searchParams.get("search")    || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo   = searchParams.get("date_to")   || "";
    const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit    = 50;
    const offset   = (page - 1) * limit;

    // Join with profiles to get user name/email
    let query = supabase
      .from("deposit_history")
      .select(`
        id, amount, note, created_at,
        user:profiles!deposit_history_user_id_fkey(id, email, display_name),
        created_by_profile:profiles!deposit_history_created_by_fkey(display_name, email)
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    // Client-side email/name search (Supabase can't filter on joined columns easily)
    let rows = data ?? [];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        const user = r.user as { email?: string; display_name?: string } | null;
        return (
          user?.email?.toLowerCase().includes(q) ||
          user?.display_name?.toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({
      history: rows,
      total: count ?? 0,
      page,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    console.error("Deposit history GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id             = searchParams.get("id");
    const reverseBalance = searchParams.get("reverse") === "true";

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Fetch the record before deleting so we know amount + user_id
    const { data: record, error: fetchErr } = await supabase
      .from("deposit_history")
      .select("id, amount, user_id")
      .eq("id", id)
      .single();

    if (fetchErr || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const serviceClient = await createServiceClient();

    // Optionally reverse the balance
    if (reverseBalance) {
      const { data: profile, error: profileErr } = await serviceClient
        .from("profiles")
        .select("balance")
        .eq("id", record.user_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const newBalance = Math.max(0, Number(profile.balance) - Number(record.amount));
      const { error: updateErr } = await serviceClient
        .from("profiles")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", record.user_id);

      if (updateErr) throw updateErr;
    }

    // Delete the history record
    const { error: deleteErr } = await serviceClient
      .from("deposit_history")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, reversed: reverseBalance });
  } catch (error) {
    console.error("Deposit history DELETE error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
