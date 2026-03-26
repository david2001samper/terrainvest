import type { ForexInstrument } from "@/lib/forex/instruments";

export type ForexBidAsk = {
  mid: number;
  bid: number;
  ask: number;
  spreadPips: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Builds a realistic bid/ask around a mid price, using typical spread
 * and widening slightly with volatility and illiquid hours.
 */
export function midToBidAsk(params: {
  instrument: Pick<ForexInstrument, "pipSize" | "typicalSpreadPips">;
  mid: number;
  changePercent24h?: number | null;
  now?: Date;
}): ForexBidAsk {
  const { instrument, mid } = params;
  const now = params.now ?? new Date();
  const pipSize = instrument.pipSize || 0.0001;

  const baseSpreadPips = instrument.typicalSpreadPips || 1.2;
  const vol = Math.abs(params.changePercent24h ?? 0);
  const volWiden = clamp(vol / 1.5, 0, 2.5); // up to ~2.5x

  // Widen around FX rollover window (approx 21:55–22:10 UTC)
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const isRollover = utcMins >= (21 * 60 + 55) && utcMins <= (22 * 60 + 10);
  const rolloverWiden = isRollover ? 1.8 : 1.0;

  const spreadPips = baseSpreadPips * (1 + 0.35 * volWiden) * rolloverWiden;
  const spread = spreadPips * pipSize;

  const ask = mid + spread / 2;
  const bid = mid - spread / 2;

  return { mid, bid, ask, spreadPips };
}

