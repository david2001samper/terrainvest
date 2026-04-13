/**
 * Geometric Brownian Motion + Ornstein-Uhlenbeck mean reversion price simulator.
 * Produces realistic micro-movements for override-priced assets so charts look organic.
 *
 * Formula per tick:
 *   nextPrice = currentPrice * exp((μ - σ²/2)·dt + σ·√dt·Z)
 *             + κ·(targetPrice - currentPrice)·dt
 *             + S/R bounce force
 */

interface SymbolState {
  current: number;
  target: number;
  window: number[];
  lastTick: number;
}

const states = new Map<string, SymbolState>();

const VOLATILITY: Record<string, number> = {
  crypto: 0.00035,
  stock: 0.0002,
  commodity: 0.00025,
  index: 0.00015,
  forex: 0.00008,
};

const DRIFT = 0.0;
const REVERSION_STRENGTH = 0.35;
const WINDOW_SIZE = 20;
const SR_PROXIMITY = 0.002;
const SR_FORCE = 0.3;

function boxMuller(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function computeSRForce(price: number, window: number[]): number {
  if (window.length < 5) return 0;
  const support = Math.min(...window);
  const resistance = Math.max(...window);
  const range = resistance - support;
  if (range <= 0) return 0;

  const distToResistance = (resistance - price) / resistance;
  const distToSupport = (price - support) / support;

  if (distToResistance >= 0 && distToResistance < SR_PROXIMITY) {
    const proximity = 1 - distToResistance / SR_PROXIMITY;
    return -SR_FORCE * proximity * (Math.random() * 0.6 + 0.4);
  }

  if (distToSupport >= 0 && distToSupport < SR_PROXIMITY) {
    const proximity = 1 - distToSupport / SR_PROXIMITY;
    return SR_FORCE * proximity * (Math.random() * 0.6 + 0.4);
  }

  return 0;
}

export function simulatePrice(
  symbol: string,
  targetPrice: number,
  assetType: string
): number {
  const key = symbol.toUpperCase();
  let state = states.get(key);

  if (!state || Math.abs(state.target - targetPrice) > targetPrice * 0.01) {
    state = {
      current: targetPrice * (1 + (Math.random() - 0.5) * 0.001),
      target: targetPrice,
      window: [targetPrice],
      lastTick: Date.now(),
    };
    states.set(key, state);
    return state.current;
  }

  const now = Date.now();
  const elapsedMs = Math.min(now - state.lastTick, 30000);
  const dt = elapsedMs / 60000;
  state.lastTick = now;

  const sigma = VOLATILITY[assetType] || VOLATILITY.stock;
  const mu = DRIFT;

  const Z = boxMuller();
  const gbmReturn = (mu - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * Z;
  let newPrice = state.current * Math.exp(gbmReturn);

  const reversionPull = REVERSION_STRENGTH * (targetPrice - newPrice) * dt;
  newPrice += reversionPull;

  const srForce = computeSRForce(newPrice, state.window);
  newPrice *= 1 + srForce * sigma;

  if (newPrice <= 0) newPrice = targetPrice * 0.99;

  state.current = newPrice;
  state.window.push(newPrice);
  if (state.window.length > WINDOW_SIZE) {
    state.window.shift();
  }

  return newPrice;
}

/**
 * Generate synthetic OHLC candle from current state.
 * Runs 4 GBM micro-steps for the candle to produce realistic body + wicks.
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

/**
 * Check if a symbol currently has simulator state (i.e. is using override pricing).
 */
export function hasSimulatorState(symbol: string): boolean {
  return states.has(symbol.toUpperCase());
}

/**
 * Reset state for a symbol (e.g. when admin changes the override price).
 */
export function resetSimulatorState(symbol: string): void {
  states.delete(symbol.toUpperCase());
}
