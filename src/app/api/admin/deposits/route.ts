import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

const MAX_DEPOSIT_AMOUNT = 1_000_000_000_000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const userId = body.userId as string | undefined;
    const amount = parseFloat(String(body.amount));
    const note   = (body.note as string | undefined)?.trim() || null;

    if (!userId) {
      return NextResponse.json({ error: "Client is required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_DEPOSIT_AMOUNT) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("balance, notify_deposit, email, display_name")
      .eq("id", userId)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const prev       = Number(profile.balance) || 0;
    const newBalance = prev + amount;
    const serviceClient = await createServiceClient();

    const { data: historyRecord, error: historyErr } = await serviceClient
      .from("deposit_history")
      .insert({
        user_id: userId,
        amount,
        note,
        created_by: admin.id,
      })
      .select("id")
      .single();

    if (historyErr || !historyRecord) {
      console.error("Deposit history insert:", historyErr);
      return NextResponse.json({ error: "Failed to record deposit" }, { status: 500 });
    }

    const { error: updateErr } = await serviceClient
      .from("profiles")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateErr) {
      console.error("Deposit balance update:", updateErr);
      await serviceClient.from("deposit_history").delete().eq("id", historyRecord.id);
      return NextResponse.json({ error: "Failed to update balance" }, { status: 500 });
    }

    // In-app notification
    if (profile.notify_deposit !== false) {
      const { error: notifErr } = await serviceClient.from("notifications").insert({
        user_id: userId,
        type:    "deposit",
        title:   "Deposit credited",
        message: `$${amount.toFixed(2)} was added to your account balance.`,
      });
      if (notifErr) {
        console.error("Deposit notification insert:", notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      previousBalance: prev,
      newBalance,
      amount,
    });
  } catch (e) {
    console.error("Admin deposit error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
