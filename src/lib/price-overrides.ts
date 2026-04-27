import { createClient } from "@/lib/supabase/server";

export async function getActiveOverrides(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("price_overrides")
    .select("symbol, override_price")
    .gt("expires_at", new Date().toISOString());
  if (error) return {};

  const map: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    map[r.symbol.toUpperCase()] = Number(r.override_price);
  });
  return map;
}

export function applyOverrides<
  T extends { symbol: string; price: number; asset_type: string },
>(items: T[], overrides: Record<string, number>): T[] {
  if (Object.keys(overrides).length === 0) return items;
  return items.map((item) => {
    const override = overrides[item.symbol?.toUpperCase()];
    if (override != null) {
      // Use the override price directly. The admin simulation route is the
      // single source of truth for the simulated curve; layering simulator
      // noise here would re-introduce the random drift bug.
      return { ...item, price: override } as T;
    }
    return item;
  });
}
