import type { ForexInstrument } from "@/lib/forex/instruments";

/**
 * Swap accrual model (simplified):
 * - swap bps are annualized basis points applied to notional USD per day
 * - accrues once per UTC day boundary; "triple swap" is not modeled here
 */
export function computeSwapDeltaUsd(params: {
  instrument: Pick<ForexInstrument, "swapLongBps" | "swapShortBps">;
  notionalUsd: number;
  unitsSigned: number;
  lastSwapAt: string | null;
  now: Date;
}): { days: number; deltaUsd: number; newLastSwapAt: string | null } {
  const { instrument, notionalUsd, unitsSigned, now } = params;
  if (!unitsSigned || notionalUsd <= 0) return { days: 0, deltaUsd: 0, newLastSwapAt: params.lastSwapAt };

  const last = params.lastSwapAt ? new Date(params.lastSwapAt) : null;
  // accrue at most once per calendar UTC day
  const start = last ?? now;
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.max(0, Math.floor((nowDay - startDay) / (24 * 60 * 60 * 1000)));
  if (days <= 0) return { days: 0, deltaUsd: 0, newLastSwapAt: params.lastSwapAt ?? now.toISOString() };

  const bps = unitsSigned > 0 ? instrument.swapLongBps : instrument.swapShortBps;
  const annualRate = (bps ?? -2.0) / 10000; // bps -> decimal
  const dailyRate = annualRate / 365;
  const deltaUsd = notionalUsd * dailyRate * days;

  return { days, deltaUsd, newLastSwapAt: now.toISOString() };
}

