import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

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

    const { data: requests, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const userIds = [...new Set((requests ?? []).map((r: { user_id: string }) => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, balance")
      .in("id", userIds);

    const profileMap = new Map((profiles ?? []).map((p: { id: string; email?: string; display_name?: string; balance?: number }) => [p.id, p]));
    const enriched = (requests ?? []).map((r: { user_id: string }) => ({
      ...r,
      user_email: profileMap.get(r.user_id)?.email,
      user_name: profileMap.get(r.user_id)?.display_name,
      user_balance: profileMap.get(r.user_id)?.balance,
    }));

    return NextResponse.json({ requests: enriched });
  } catch (e) {
    console.error("Admin withdrawals error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: req } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (!req || req.status !== "pending") {
      return NextResponse.json({ error: "Request not found or already processed" }, { status: 400 });
    }

    const userId = req.user_id;
    const amount = parseFloat(req.amount);

    if (action === "approve") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", userId)
        .single();
      const balance = profile?.balance ?? 0;
      if (balance < amount) {
        return NextResponse.json({ error: "User has insufficient balance" }, { status: 400 });
      }

      const serviceClient = await createServiceClient();
      const { error: updateError } = await serviceClient
        .from("profiles")
        .update({
          balance: balance - amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) throw updateError;
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error: reqError } = await supabase
      .from("withdrawal_requests")
      .update({
        status: newStatus,
        processed_at: new Date().toISOString(),
        processed_by: admin.id,
      })
      .eq("id", id);

    if (reqError) throw reqError;

    // Check if user wants withdrawal notifications
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("notify_withdrawal")
      .eq("id", userId)
      .single();

    if (userProfile?.notify_withdrawal !== false) {
      const serviceClient = action === "approve" ? await createServiceClient() : await createServiceClient();
      await serviceClient.from("notifications").insert({
        user_id: userId,
        type: "withdrawal",
        title: action === "approve" ? "Withdrawal Approved" : "Withdrawal Rejected",
        message:
          action === "approve"
            ? `Your withdrawal of $${amount.toFixed(2)} has been approved and processed.`
            : `Your withdrawal of $${amount.toFixed(2)} has been rejected. Contact support for details.`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin withdrawal action error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
