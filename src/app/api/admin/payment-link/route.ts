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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const amount = parseFloat(body.amount);
    const currency = (body.currency || "USD").toUpperCase();
    const email = body.email?.trim() || "";

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "paygate_wallet")
      .single();

    const wallet = row?.value?.trim();
    if (!wallet || !wallet.startsWith("0x")) {
      return NextResponse.json(
        { error: "PayGate wallet not configured. Set it in Admin → Settings → Deposit Wallet Addresses." },
        { status: 400 }
      );
    }

    const walletRes = await fetch(
      `https://api.paygate.to/control/wallet.php?address=${encodeURIComponent(wallet)}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!walletRes.ok) {
      return NextResponse.json(
        { error: `PayGate API returned ${walletRes.status}` },
        { status: 502 }
      );
    }

    const walletData = await walletRes.json();
    const addressIn = walletData?.address_in;

    if (!addressIn) {
      return NextResponse.json(
        { error: "PayGate API did not return a receiving address. Check your wallet." },
        { status: 502 }
      );
    }

    const params = new URLSearchParams({
      address: addressIn,
      amount: String(amount),
      currency,
    });
    if (email) params.set("email", email);

    const checkoutUrl = `https://checkout.paygate.to/pay.php?${params.toString()}`;

    return NextResponse.json({ url: checkoutUrl });
  } catch (e) {
    console.error("payment-link error:", e);
    return NextResponse.json({ error: "Failed to generate payment link" }, { status: 500 });
  }
}
