import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_PUBLIC_CONTENT, PUBLIC_CONTENT_KEYS, CONTACT_INFO_KEYS, DEFAULT_CONTACT_INFO, getPublicContentPage } from "@/lib/public-content";

const HOME_KEYS = ["home_journey", "home_mission", "home_values", "home_cta"] as const;

export type ContentKey = (typeof PUBLIC_CONTENT_KEYS)[number];
export type HomeContentKey = (typeof HOME_KEYS)[number];

async function fetchContentUncached(key: string): Promise<string> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? "";
}

async function fetchAllContentUncached(keys: readonly string[]): Promise<Record<string, string>> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", keys);

  const result: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    result[r.key] = r.value ?? "";
  });
  return result;
}

export async function getContent(page: string): Promise<string> {
  const key = getPublicContentPage(page)?.key ?? "about_us";
  return unstable_cache(
    async () => {
      const content = await fetchContentUncached(key);
      return content || DEFAULT_PUBLIC_CONTENT[key] || "";
    },
    [`content-${key}`],
    { revalidate: 60, tags: ["content"] }
  )();
}

export async function getAllContent(): Promise<Record<string, string>> {
  return unstable_cache(
    async () => {
      const content = await fetchAllContentUncached([...PUBLIC_CONTENT_KEYS, ...HOME_KEYS]);
      return Object.fromEntries(
        Object.entries({ ...DEFAULT_PUBLIC_CONTENT, ...content }).map(([key, value]) => [
          key,
          value || DEFAULT_PUBLIC_CONTENT[key] || "",
        ])
      );
    },
    ["all-content"],
    { revalidate: 60, tags: ["content", "home"] }
  )();
}

export async function getHomeContent(): Promise<Record<string, string>> {
  return unstable_cache(
    () => fetchAllContentUncached([...HOME_KEYS]),
    ["home-content"],
    { revalidate: 60, tags: ["home"] }
  )();
}

export async function getContactInfo(): Promise<{ phone: string; email: string }> {
  return unstable_cache(
    async () => {
      const data = await fetchAllContentUncached([...CONTACT_INFO_KEYS]);
      return {
        phone: data.contact_phone || DEFAULT_CONTACT_INFO.contact_phone,
        email: data.contact_email || DEFAULT_CONTACT_INFO.contact_email,
      };
    },
    ["contact-info"],
    { revalidate: 60, tags: ["content"] }
  )();
}
