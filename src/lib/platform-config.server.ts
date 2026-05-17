import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { BRANDING_DEFAULTS, BRANDING_KEYS, type PlatformBranding } from "@/lib/platform-config";

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
