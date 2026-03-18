import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("client_bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ accounts: data ?? [] });
  } catch (e) {
    console.error("bank-accounts GET:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const bank_name = String(body.bank_name ?? "").trim();
    const account_holder_name = String(body.account_holder_name ?? "").trim();
    const account_number_or_iban = String(body.account_number_or_iban ?? "").trim();
    const label = typeof body.label === "string" ? body.label.trim() || null : null;
    const routing_number = typeof body.routing_number === "string" ? body.routing_number.trim() || null : null;
    const swift_bic = typeof body.swift_bic === "string" ? body.swift_bic.trim() || null : null;
    const country = typeof body.country === "string" ? body.country.trim() || null : null;

    if (!bank_name || !account_holder_name || !account_number_or_iban) {
      return NextResponse.json(
        { error: "Bank name, account holder, and account number / IBAN are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("client_bank_accounts")
      .insert({
        user_id: user.id,
        label,
        bank_name,
        account_holder_name,
        account_number_or_iban,
        routing_number,
        swift_bic,
        country,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ account: data });
  } catch (e) {
    console.error("bank-accounts POST:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
