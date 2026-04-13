/**
 * Price simulator for override-priced assets.
 *
 * Directly tracks the override target price with tiny organic jitter
 * and smoothing. This ensures:
 *  - During simulation (fast-moving target): price follows the path tightly
 *  - During flat override: price oscillates gently around the target
 *
 * The displayed price = 70% (target + jitter) + 30% previous
 * This gives continuity between frames while tracking the target within
 * a few dollars even when it moves $10+/tick.
 */

interface SymbolState {
  current: number;
  target: number;
  lastTick: number;
}

const states = new Map<string, SymbolState>();

const JITTER_SCALE: Record<string, number> = {
  crypto: 0.00025,
  stock: 0.00015,
  commodity: 0.00018,
  index: 0.00010,
  forex: 0.00006,
};

function boxMuller(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function simulatePrice(
  symbol: string,
  targetPrice: number,
  assetType: string
): number {
  const key = symbol.toUpperCase();
  let state = states.get(key);

  if (!state) {
    state = { current: targetPrice, target: targetPrice, lastTick: Date.now() };
    states.set(key, state);
    return targetPrice;
  }

  state.target = targetPrice;
  state.lastTick = Date.now();

  const scale = JITTER_SCALE[assetType] || JITTER_SCALE.stock;
  const jitter = targetPrice * scale * boxMuller();

  const raw = targetPrice + jitter;
  const newPrice = raw * 0.7 + state.current * 0.3;

  state.current = Math.max(newPrice, 0.0001);
  return state.current;
}

/**
 * Generate synthetic OHLC candle by sampling simulatePrice 4 times.
 */
export function simulateCandle(
  symbol: string,
  targetPrice: number,
  assetType: string
): { open: number; high: number; low: number; close: number } {
  const open = simulatePrice(symbol, targetPrice, assetType);
  let high = open;
  let low = open;
  let close = open;

  for (let i = 0; i < 3; i++) {
    const p = simulatePrice(symbol, targetPrice, assetType);
    if (p > high) high = p;
    if (p < low) low = p;
    close = p;
  }

  return { open, high, low, close };
}

export function hasSimulatorState(symbol: string): boolean {
  return states.has(symbol.toUpperCase());
}

export function resetSimulatorState(symbol: string): void {
  states.delete(symbol.toUpperCase());
}
