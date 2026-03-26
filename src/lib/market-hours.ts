export type MarketHoursResult = { open: boolean; reason?: string };

export function resolveAssetTypeFromSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.endsWith("=X")) return "forex";
  if (s.startsWith("^")) return "index";
  if (s.endsWith("=F")) return "commodity";
  return "stock";
}

/**
 * Simplified market-hours checks.
 * - crypto: 24/7
 * - forex: Sun 22:00 UTC → Fri 22:00 UTC (approx 5pm ET)
 * - stocks/index/commodity: Mon–Fri 9:30–16:00 ET, approximated as UTC-4
 *
 * Note: This does not account for DST/holidays; it's a best-effort guardrail.
 */
export function isMarketOpen(assetType: string, now = new Date()): MarketHoursResult {
  const utcDay = now.getUTCDay(); // 0=Sun .. 6=Sat
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (assetType === "crypto") return { open: true };

  if (assetType === "forex") {
    if (utcDay === 6) return { open: false, reason: "Forex market is closed on Saturday." };
    if (utcDay === 0 && utcMins < 22 * 60) return { open: false, reason: "Forex market opens Sunday 5:00 PM ET." };
    if (utcDay === 5 && utcMins >= 22 * 60) return { open: false, reason: "Forex market is closed. Opens Sunday 5:00 PM ET." };
    return { open: true };
  }

  // US session approximation. ET ≈ UTC-4.
  if (utcDay === 0 || utcDay === 6) return { open: false, reason: "Market is closed on weekends." };
  const etMins = ((utcMins - 4 * 60) + 1440) % 1440;
  const openMins = 9 * 60 + 30;
  const closeMins = 16 * 60;
  if (etMins < openMins) return { open: false, reason: "Market opens at 9:30 AM ET." };
  if (etMins >= closeMins) return { open: false, reason: "Market is closed (after hours)." };
  return { open: true };
}

