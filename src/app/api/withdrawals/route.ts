import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type BankDetailsSnapshot = {
  label?: string | null;
  bank_name: string;
  account_holder_name: string;
  account_number_or_iban: string;
  routing_number?: string | null;
  swift_bic?: string | null;
  country?: string | null;
};

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
    const saveBankAccount = Boolean(body.save_bank_account);
    const bankAccountId = typeof body.bank_account_id === "string" ? body.bank_account_id.trim() : "";

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!["btc", "usdt", "bank"].includes(method)) {
      return NextResponse.json({ error: "Invalid method" }, { status: 400 });
    }

    if ((method === "btc" || method === "usdt") && !walletAddress) {
      return NextResponse.json({ error: "Wallet address is required for crypto withdrawals" }, { status: 400 });
    }

    let bankDetails: BankDetailsSnapshot | null = null;

    if (method === "bank") {
      if (bankAccountId) {
        const { data: saved, error: accErr } = await supabase
          .from("client_bank_accounts")
          .select("*")
          .eq("id", bankAccountId)
          .eq("user_id", user.id)
          .single();

        if (accErr || !saved) {
          return NextResponse.json({ error: "Saved bank account not found" }, { status: 400 });
        }
        bankDetails = {
          label: saved.label,
          bank_name: saved.bank_name,
          account_holder_name: saved.account_holder_name,
          account_number_or_iban: saved.account_number_or_iban,
          routing_number: saved.routing_number,
          swift_bic: saved.swift_bic,
          country: saved.country,
        };
      } else {
        const bank_name = String(body.bank_name ?? "").trim();
        const account_holder_name = String(body.account_holder_name ?? "").trim();
        const account_number_or_iban = String(body.account_number_or_iban ?? "").trim();
        const routing_number =
          typeof body.routing_number === "string" ? body.routing_number.trim() || null : null;
        const swift_bic = typeof body.swift_bic === "string" ? body.swift_bic.trim() || null : null;
        const country = typeof body.country === "string" ? body.country.trim() || null : null;
        const label = typeof body.bank_label === "string" ? body.bank_label.trim() || null : null;

        if (!bank_name || !account_holder_name || !account_number_or_iban) {
          return NextResponse.json(
            { error: "Enter your bank name, account holder name, and account number / IBAN" },
            { status: 400 }
          );
        }

        bankDetails = {
          label,
          bank_name,
          account_holder_name,
          account_number_or_iban,
          routing_number,
          swift_bic,
          country,
        };

        if (saveBankAccount) {
          const { error: insErr } = await supabase.from("client_bank_accounts").insert({
            user_id: user.id,
            label,
            bank_name,
            account_holder_name,
            account_number_or_iban,
            routing_number,
            swift_bic,
            country,
          });
          if (insErr) {
            console.error("save bank account:", insErr);
            return NextResponse.json(
              {
                error:
                  "Could not save bank details. Run the client_bank_accounts migration in Supabase, or try again without “Save for next time”.",
              },
              { status: 400 }
            );
          }
        }
      }
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

    const insertRow: Record<string, unknown> = {
      user_id: user.id,
      amount,
      method,
      status: "pending",
      wallet_address: method === "bank" ? null : walletAddress || null,
    };

    if (method === "bank" && bankDetails) {
      insertRow.bank_details = bankDetails;
    }

    const { data: req, error } = await supabase
      .from("withdrawal_requests")
      .insert(insertRow)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, request: req });
  } catch (e) {
    console.error("Withdrawal error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
