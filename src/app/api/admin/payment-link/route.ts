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

export async function GET() {
  return NextResponse.json({ ok: true });
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

    const callbackUrl = `${request.nextUrl.origin}/api/admin/payment-link`;
    const walletApiUrl =
      `https://api.paygate.to/control/wallet.php?address=${encodeURIComponent(wallet)}` +
      `&callback=${encodeURIComponent(callbackUrl)}`;

    const walletRes = await fetch(walletApiUrl, { signal: AbortSignal.timeout(15000) });

    let walletBody: string | null = null;
    try {
      walletBody = await walletRes.text();
    } catch { /* ignore */ }

    if (!walletRes.ok) {
      console.error("PayGate wallet API error:", walletRes.status, walletBody);
      return NextResponse.json(
        { error: `PayGate API error (${walletRes.status}). Ensure your USDC Polygon wallet is valid.` },
        { status: 502 }
      );
    }

    let walletData: Record<string, unknown> | null = null;
    try {
      walletData = walletBody ? JSON.parse(walletBody) : null;
    } catch {
      console.error("PayGate returned non-JSON:", walletBody);
      return NextResponse.json(
        { error: "PayGate returned an unexpected response. Try again." },
        { status: 502 }
      );
    }

    const addressIn = walletData?.address_in as string | undefined;

    if (!addressIn) {
      console.error("PayGate wallet response missing address_in:", walletData);
      return NextResponse.json(
        { error: "PayGate did not return a receiving address. Verify your wallet starts with 0x." },
        { status: 502 }
      );
    }

    // PayGate returns address_in already percent-encoded. URLSearchParams would
    // encode "%" again (%25…) and break checkout — same as WooCommerce: raw concat.
    const parts = [
      `address=${addressIn}`,
      `amount=${Number(amount)}`,
      `currency=${encodeURIComponent(currency)}`,
    ];
    parts.push(`email=${encodeURIComponent(email || "")}`);

    const checkoutUrl = `https://checkout.paygate.to/pay.php?${parts.join("&")}`;

    return NextResponse.json({ url: checkoutUrl });
  } catch (e) {
    console.error("payment-link error:", e);
    return NextResponse.json({ error: "Failed to generate payment link" }, { status: 500 });
  }
}
