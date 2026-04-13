import { createClient } from "@/lib/supabase/server";
import { simulatePrice } from "@/lib/price-simulator";

export async function getActiveOverrides(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_overrides")
    .select("symbol, override_price")
    .gt("expires_at", new Date().toISOString());

  const map: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    map[r.symbol.toUpperCase()] = Number(r.override_price);
  });
  return map;
}

export function applyOverrides<
  T extends { symbol: string; price?: number; asset_type?: string },
>(items: T[], overrides: Record<string, number>): T[] {
  if (Object.keys(overrides).length === 0) return items;
  return items.map((item) => {
    const override = overrides[item.symbol?.toUpperCase()];
    if (override != null) {
      const assetType = (item as { asset_type?: string }).asset_type || "stock";
      const simulated = simulatePrice(item.symbol, override, assetType);
      return { ...item, price: simulated };
    }
    return item;
  });
}
