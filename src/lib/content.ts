import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

const CONTENT_KEYS = ["about_us", "terms_of_service", "privacy_policy", "contact_us", "support"] as const;
const HOME_KEYS = ["home_journey", "home_mission", "home_values", "home_cta"] as const;

export type ContentKey = (typeof CONTENT_KEYS)[number];
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
  const keyMap: Record<string, string> = {
    about: "about_us",
    terms: "terms_of_service",
    privacy: "privacy_policy",
    contact: "contact_us",
    support: "support",
  };
  const key = keyMap[page] ?? "about_us";
  return unstable_cache(
    () => fetchContentUncached(key),
    [`content-${key}`],
    { revalidate: 60, tags: ["content"] }
  )();
}

export async function getAllContent(): Promise<Record<string, string>> {
  return unstable_cache(
    () => fetchAllContentUncached([...CONTENT_KEYS, ...HOME_KEYS]),
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
