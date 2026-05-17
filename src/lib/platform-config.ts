import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export const BRANDING_DEFAULTS = {
  platform_name: "Terra Invest VIP",
  platform_short_name: "Terra Invest",
  platform_tagline: "Premium Trading Platform",
  platform_domain: "terrainvest.vip",
  platform_footer_domain: "terrainvest.vip",
  admin_email: "admin@terrainvestvip.com",
  email_from_name: "Terra Invest VIP",
  email_from_address: "support@terrainvestvip.com",
  admin_alert_email: "admin@terrainvestvip.com",
  approval_time_text: "Approval usually takes 10 minutes to 1 hour, and your dedicated account manager will contact you shortly.",
  email_enabled: "false",
  signup_approval_enabled: "false",
} as const;

export type PlatformBranding = Record<keyof typeof BRANDING_DEFAULTS, string>;

export const BRANDING_KEYS = Object.keys(BRANDING_DEFAULTS) as (keyof typeof BRANDING_DEFAULTS)[];

export async function getPlatformBranding(): Promise<PlatformBranding> {
  return unstable_cache(
    async () => {
      try {
        const supabase = await createServiceClient();
        const { data } = await supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", BRANDING_KEYS);

        const result = { ...BRANDING_DEFAULTS } as Record<string, string>;
        for (const row of data ?? []) {
          if (row.value?.trim()) result[row.key] = row.value;
        }
        return result as PlatformBranding;
      } catch {
        return { ...BRANDING_DEFAULTS };
      }
    },
    ["platform-branding"],
    { revalidate: 60, tags: ["branding", "content"] }
  )();
}
