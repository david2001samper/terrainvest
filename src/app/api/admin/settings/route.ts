import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PUBLIC_CONTENT, PUBLIC_CONTENT_KEYS, DEFAULT_CONTACT_INFO, CONTACT_INFO_KEYS } from "@/lib/public-content";
import { BRANDING_KEYS, BRANDING_DEFAULTS } from "@/lib/platform-config";

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
        "wallet_btc", "wallet_usdt",
        ...PUBLIC_CONTENT_KEYS,
        ...CONTACT_INFO_KEYS,
        "home_journey", "home_mission", "home_values", "home_cta",
        "order_book_cache_minutes",
        ...BRANDING_KEYS,
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
      default_balance: settings.default_balance ?? "0",
      fee_per_trade: settings.fee_per_trade ?? "0.10",
      announcement: settings.announcement ?? "",
      maintenance_mode: settings.maintenance_mode ?? "false",
      currency_rates,
      wallet_btc: settings.wallet_btc ?? "",
      wallet_usdt: settings.wallet_usdt ?? "",
      about_us: settings.about_us ?? DEFAULT_PUBLIC_CONTENT.about_us,
      terms_of_service: settings.terms_of_service ?? DEFAULT_PUBLIC_CONTENT.terms_of_service,
      privacy_policy: settings.privacy_policy ?? DEFAULT_PUBLIC_CONTENT.privacy_policy,
      contact_us: settings.contact_us ?? DEFAULT_PUBLIC_CONTENT.contact_us,
      support: settings.support ?? DEFAULT_PUBLIC_CONTENT.support,
      journey: settings.journey ?? DEFAULT_PUBLIC_CONTENT.journey,
      our_history: settings.our_history ?? DEFAULT_PUBLIC_CONTENT.our_history,
      trading_approach: settings.trading_approach ?? DEFAULT_PUBLIC_CONTENT.trading_approach,
      account_management: settings.account_management ?? DEFAULT_PUBLIC_CONTENT.account_management,
      contact_phone: settings.contact_phone ?? DEFAULT_CONTACT_INFO.contact_phone,
      contact_email: settings.contact_email ?? DEFAULT_CONTACT_INFO.contact_email,
      home_journey: settings.home_journey ?? "",
      home_mission: settings.home_mission ?? "",
      home_values: settings.home_values ?? "",
      home_cta: settings.home_cta ?? "",
      order_book_cache_minutes: settings.order_book_cache_minutes ?? "5",
      ...Object.fromEntries(BRANDING_KEYS.map((k) => [k, settings[k] ?? BRANDING_DEFAULTS[k]])),
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
      "wallet_btc", "wallet_usdt",
      ...PUBLIC_CONTENT_KEYS,
      ...CONTACT_INFO_KEYS,
      "home_journey", "home_mission", "home_values", "home_cta",
      "order_book_cache_minutes",
      ...BRANDING_KEYS,
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

    // If signup approval is turned off, immediately unlock all pending user accounts.
    if (body.signup_approval_enabled === "false") {
      await supabase
        .from("profiles")
        .update({ is_approved: true, updated_at: new Date().toISOString() })
        .eq("role", "user")
        .eq("is_approved", false);
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
    revalidateTag("branding", "max");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
