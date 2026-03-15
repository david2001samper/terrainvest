import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const amount = parseFloat(body.amount);
    const method = body.method ?? "btc";
    const walletAddress = typeof body.wallet_address === "string" ? body.wallet_address.trim() : "";

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!["btc", "usdt", "bank"].includes(method)) {
      return NextResponse.json({ error: "Invalid method" }, { status: 400 });
    }

    if ((method === "btc" || method === "usdt") && !walletAddress) {
      return NextResponse.json({ error: "Wallet address is required for crypto withdrawals" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("balance, is_locked")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    if (profile.is_locked) return NextResponse.json({ error: "Account locked" }, { status: 403 });
    if ((profile.balance ?? 0) < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const { data: req, error } = await supabase
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount,
        method,
        status: "pending",
        wallet_address: walletAddress || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, request: req });
  } catch (e) {
    console.error("Withdrawal error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
