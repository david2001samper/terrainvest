import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.35, AUD: 1.53 };

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["fee_per_trade", "default_balance", "currency_rates"]);

    const settings: Record<string, string> = {};
    (data ?? []).forEach((r) => {
      settings[r.key] = r.value;
    });

    let currency_rates = { ...DEFAULT_RATES };
    try {
      if (settings.currency_rates) {
        currency_rates = { ...currency_rates, ...JSON.parse(settings.currency_rates) };
      }
    } catch {
      /* use defaults */
    }

    return NextResponse.json({
      fee_per_trade: parseFloat(settings.fee_per_trade ?? "0.10"),
      default_balance: settings.default_balance ?? "10000000",
      currency_rates,
    });
  } catch {
    return NextResponse.json(
      { fee_per_trade: 0.1, default_balance: "10000000", currency_rates: DEFAULT_RATES },
      { status: 500 }
    );
  }
}
