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
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = supabase.from("profiles").select("*", { count: "exact" });

    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Merge last_sign_in_at from Supabase Auth — this is always accurate since
    // Auth updates it on every signInWithPassword call, regardless of RLS.
    // We use the service client so we can call auth.admin.listUsers().
    const authSignInMap: Record<string, string | null> = {};
    try {
      const service = await createServiceClient();
      // Fetch up to 1000 auth users. For larger installs, paginate as needed.
      const { data: authData } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      for (const u of authData?.users ?? []) {
        authSignInMap[u.id] = u.last_sign_in_at ?? null;
      }
    } catch {
      // Non-fatal: fall back to profiles.last_login_at if auth fetch fails.
    }

    // Attach auth_last_sign_in_at to each profile. The UI picks the most
    // recent of this and profiles.last_login_at.
    const clients = (data ?? []).map((p) => ({
      ...p,
      auth_last_sign_in_at: authSignInMap[p.id] ?? null,
    }));

    return NextResponse.json({
      clients,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Admin clients error:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { userId, balance, total_pnl, vip_level, role, is_locked, display_name, preferred_currency, email } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (total_pnl !== undefined && balance === undefined) {
      const { data: current } = await supabase
        .from("profiles")
        .select("balance, total_pnl")
        .eq("id", userId)
        .single();

      if (current) {
        const pnlDelta = parseFloat(String(total_pnl)) - (current.total_pnl ?? 0);
        updates.total_pnl = total_pnl;
        updates.balance = (current.balance ?? 0) + pnlDelta;
      }
    } else {
      if (total_pnl !== undefined) updates.total_pnl = total_pnl;
    }

    if (balance !== undefined) {
      updates.balance = balance;

      // Send deposit notification if balance increased
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("balance, notify_deposit")
        .eq("id", userId)
        .single();

      if (currentProfile && balance > (currentProfile.balance ?? 0) && currentProfile.notify_deposit !== false) {
        const depositAmount = balance - (currentProfile.balance ?? 0);
        const serviceClient = await createServiceClient();
        await serviceClient.from("notifications").insert({
          user_id: userId,
          type: "deposit",
          title: "Deposit Confirmed",
          message: `A deposit of $${depositAmount.toFixed(2)} has been credited to your account.`,
        });
      }
    }
    if (vip_level !== undefined) updates.vip_level = vip_level;
    if (role !== undefined) updates.role = role;
    if (display_name !== undefined) updates.display_name = display_name;
    if (preferred_currency !== undefined) updates.preferred_currency = preferred_currency;
    if (body.is_locked !== undefined) updates.is_locked = body.is_locked;

    if (email !== undefined) {
      updates.email = email;
      try {
        const serviceClient = await createServiceClient();
        const { error: authError } = await serviceClient.auth.admin.updateUserById(userId, { email });
        if (authError) {
          console.error("Admin email update error:", authError);
          return NextResponse.json({ error: authError.message }, { status: 400 });
        }
      } catch (e) {
        console.error("Admin email update error:", e);
        return NextResponse.json({ error: "Failed to update auth email" }, { status: 500 });
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
