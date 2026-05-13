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

const MAX_MONEY_AMOUNT = 1_000_000_000_000;

function parseMoneyField(value: unknown, field: string, options: { allowNegative?: boolean } = {}) {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return { error: `${field} must be a valid number` };
  }
  if (!options.allowNegative && parsed < 0) {
    return { error: `${field} cannot be negative` };
  }
  if (Math.abs(parsed) > MAX_MONEY_AMOUNT) {
    return { error: `${field} is outside the allowed range` };
  }
  return { value: parsed };
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

    const profiles = data ?? [];
    const userIds = profiles.map((p) => p.id);

    // Aggregate trade stats and fetch auth metadata for the CURRENT PAGE
    // only — not the full user table. Replaces:
    //   - 1× listUsers(perPage:1000)  →  N× getUserById (parallel, only for the page)
    //   - N× HTTP /api/admin/user-activity calls from the browser
    //   - N× full per-user trades scans  →  one IN(userIds) query, aggregated in JS
    let tradeStats: Record<string, { count: number; volume: number }> = {};
    const authSignInMap: Record<string, string | null> = {};

    if (userIds.length > 0) {
      const service = await createServiceClient();

      const [tradesRes, ...authResults] = await Promise.all([
        // ONE query for trades across every user on this page
        supabase
          .from("trades")
          .select("user_id, total")
          .in("user_id", userIds),
        // Parallel auth lookups, but only for visible users
        ...userIds.map((id) => service.auth.admin.getUserById(id)),
      ]);

      // Aggregate trades by user
      tradeStats = {};
      for (const row of tradesRes.data ?? []) {
        const uid = row.user_id as string;
        if (!tradeStats[uid]) tradeStats[uid] = { count: 0, volume: 0 };
        tradeStats[uid].count += 1;
        tradeStats[uid].volume += Number(row.total) || 0;
      }

      // Build auth sign-in map
      authResults.forEach((res, idx) => {
        const uid = userIds[idx];
        const u = res.data?.user;
        authSignInMap[uid] = u?.last_sign_in_at ?? null;
      });
    }

    const clients = profiles.map((p) => {
      const stats = tradeStats[p.id] ?? { count: 0, volume: 0 };
      return {
        ...p,
        auth_last_sign_in_at: authSignInMap[p.id] ?? null,
        trade_count: stats.count,
        total_volume: stats.volume,
        avg_trade_size: stats.count > 0 ? stats.volume / stats.count : 0,
      };
    });

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
    const { userId, balance, total_pnl, vip_level, role, display_name, preferred_currency, email } = body;
    const applyPnlToBalance = body.apply_pnl_to_balance === true;

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (total_pnl !== undefined) {
      const parsedPnl = parseMoneyField(total_pnl, "Total P&L", { allowNegative: true });
      if ("error" in parsedPnl) {
        return NextResponse.json({ error: parsedPnl.error }, { status: 400 });
      }
      updates.total_pnl = parsedPnl.value;
    }

    if (balance !== undefined) {
      const parsedBalance = parseMoneyField(balance, "Balance");
      if ("error" in parsedBalance) {
        return NextResponse.json({ error: parsedBalance.error }, { status: 400 });
      }
      updates.balance = parsedBalance.value;
    }

    if (applyPnlToBalance) {
      if (total_pnl === undefined) {
        return NextResponse.json(
          { error: "Total P&L is required when applying P&L change to balance" },
          { status: 400 }
        );
      }

      const { data: currentProfile, error: currentProfileError } = await supabase
        .from("profiles")
        .select("balance, total_pnl")
        .eq("id", userId)
        .single();

      if (currentProfileError || !currentProfile) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }

      const currentPnl = Number(currentProfile.total_pnl) || 0;
      const baseBalance = balance !== undefined
        ? Number(updates.balance)
        : Number(currentProfile.balance) || 0;
      const pnlDelta = Number(updates.total_pnl) - currentPnl;
      const adjustedBalance = baseBalance + pnlDelta;

      if (!Number.isFinite(adjustedBalance) || adjustedBalance < 0) {
        return NextResponse.json(
          { error: "Applying the P&L change would make the balance invalid" },
          { status: 400 }
        );
      }

      updates.balance = adjustedBalance;
    }

    if (updates.balance !== undefined) {
      // Send deposit notification if balance increased
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("balance, notify_deposit")
        .eq("id", userId)
        .single();

      const nextBalance = Number(updates.balance);
      if (currentProfile && nextBalance > (currentProfile.balance ?? 0) && currentProfile.notify_deposit !== false) {
        const depositAmount = nextBalance - (currentProfile.balance ?? 0);
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
    if (body.is_approved !== undefined) updates.is_approved = body.is_approved;

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
