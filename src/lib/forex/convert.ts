import { getYahooFinance } from "@/lib/yahoo";

type CachedRate = { v: number; t: number };
const TTL_MS = 10_000;
const cache = new Map<string, CachedRate>();

async function fetchMid(symbol: string): Promise<number> {
  const key = symbol.toUpperCase();
  const c = cache.get(key);
  if (c && Date.now() - c.t < TTL_MS) return c.v;
  const yf = await getYahooFinance();
  const q = await yf.quote(key);
  const mid = q.regularMarketPrice ?? 0;
  if (mid > 0) cache.set(key, { v: mid, t: Date.now() });
  return mid;
}

/**
 * Convert an amount in `from` currency to USD using FX majors.
 * Supports: USD, EUR, GBP, JPY, CHF, CAD, AUD, NZD.
 */
export async function convertToUSD(from: string, amount: number): Promise<number> {
  const ccy = from.toUpperCase();
  if (ccy === "USD") return amount;

  // Direct pairs like GBPUSD=X
  const direct = `${ccy}USD=X`;
  try {
    const r = await fetchMid(direct);
    if (r > 0) return amount * r;
  } catch {
    // continue
  }

  // Inverse pairs like USDJPY=X for JPY
  const inverse = `USD${ccy}=X`;
  const r = await fetchMid(inverse);
  if (r > 0) return amount / r;

  // Fallback: no conversion available; treat as USD
  return amount;
}

