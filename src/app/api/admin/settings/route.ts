import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
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
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", [
        "default_balance", "fee_per_trade", "announcement", "maintenance_mode", "currency_rates",
        "wallet_btc", "wallet_usdt", "paygate_wallet",
        "about_us", "terms_of_service", "privacy_policy", "contact_us", "support",
        "home_journey", "home_mission", "home_values", "home_cta",
        "order_book_cache_minutes",
      ]);

    if (error) throw error;

    const settings: Record<string, string> = {};
    (data ?? []).forEach((r) => {
      settings[r.key] = r.value;
    });

    let currency_rates: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.35, AUD: 1.53 };
    try {
      if (settings.currency_rates) {
        currency_rates = { ...currency_rates, ...JSON.parse(settings.currency_rates) };
      }
    } catch {
      /* use defaults */
    }

    return NextResponse.json({
      default_balance: settings.default_balance ?? "10000000",
      fee_per_trade: settings.fee_per_trade ?? "0.10",
      announcement: settings.announcement ?? "",
      maintenance_mode: settings.maintenance_mode ?? "false",
      currency_rates,
      wallet_btc: settings.wallet_btc ?? "",
      wallet_usdt: settings.wallet_usdt ?? "",
      paygate_wallet: settings.paygate_wallet ?? "",
      about_us: settings.about_us ?? "",
      terms_of_service: settings.terms_of_service ?? "",
      privacy_policy: settings.privacy_policy ?? "",
      contact_us: settings.contact_us ?? "",
      support: settings.support ?? "",
      home_journey: settings.home_journey ?? "",
      home_mission: settings.home_mission ?? "",
      home_values: settings.home_values ?? "",
      home_cta: settings.home_cta ?? "",
      order_book_cache_minutes: settings.order_book_cache_minutes ?? "5",
    });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const keys = [
      "default_balance", "fee_per_trade", "announcement", "maintenance_mode",
      "wallet_btc", "wallet_usdt", "paygate_wallet",
      "about_us", "terms_of_service", "privacy_policy", "contact_us", "support",
      "home_journey", "home_mission", "home_values", "home_cta",
      "order_book_cache_minutes",
    ];

    for (const key of keys) {
      if (body[key] !== undefined) {
        await supabase
          .from("platform_settings")
          .upsert(
            { key, value: String(body[key]), updated_at: new Date().toISOString() },
            { onConflict: "key" }
          );
      }
    }

    if (body.currency_rates !== undefined && typeof body.currency_rates === "object") {
      await supabase
        .from("platform_settings")
        .upsert(
          { key: "currency_rates", value: JSON.stringify(body.currency_rates), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
    }

    revalidateTag("content", "max");
    revalidateTag("home", "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
