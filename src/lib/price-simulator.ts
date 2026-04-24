/**
 * Price simulator — Ornstein-Uhlenbeck process with momentum and
 * volatility clustering.
 *
 * Creates realistic micro-trends (mini rallies/pullbacks) around the
 * target price instead of pure random noise. Works correctly at any
 * polling interval (1s, 8s, 30s) because all dynamics are dt-scaled.
 *
 * When a simulation is running the target price already moves along
 * the macro ramp/hold/recovery curve; this module adds the organic
 * tick-level texture on top.
 */

interface SymbolState {
  current: number;
  target: number;
  velocity: number;
  volState: number;
  lastTick: number;
}

const states = new Map<string, SymbolState>();

interface AssetDynamics {
  /** Base volatility per √second as a fraction of price */
  vol: number;
  /** Mean-reversion strength (higher = snaps to target faster) */
  reversion: number;
  /** Velocity carry per second (0–1, higher = longer trends) */
  momentum: number;
  /** Max allowed drift from target as a fraction of price */
  maxDrift: number;
}

const DYNAMICS: Record<string, AssetDynamics> = {
  crypto:    { vol: 0.0010,  reversion: 0.06, momentum: 0.88, maxDrift: 0.018 },
  stock:     { vol: 0.00050, reversion: 0.08, momentum: 0.85, maxDrift: 0.012 },
  commodity: { vol: 0.00065, reversion: 0.07, momentum: 0.86, maxDrift: 0.014 },
  index:     { vol: 0.00035, reversion: 0.10, momentum: 0.82, maxDrift: 0.008 },
  forex:     { vol: 0.00020, reversion: 0.12, momentum: 0.80, maxDrift: 0.005 },
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
  let s = states.get(key);

  if (!s) {
    s = {
      current: targetPrice,
      target: targetPrice,
      velocity: 0,
      volState: 1,
      lastTick: Date.now(),
    };
    states.set(key, s);
    return targetPrice;
  }

  const cfg = DYNAMICS[assetType] || DYNAMICS.stock;

  const elapsedSec = Math.min((Date.now() - s.lastTick) / 1000, 10);
  s.lastTick = Date.now();
  s.target = targetPrice;

  // --- Volatility clustering (GARCH-like) ---
  // volState drifts slowly between ~0.4 and ~1.6, creating calm/chaotic periods
  const volImpulse = 0.4 + Math.abs(boxMuller()) * 0.6;
  s.volState = s.volState * 0.93 + volImpulse * 0.07;
  const vol = cfg.vol * s.volState;

  // --- Random shock (scaled by √dt for time consistency) ---
  const shock = boxMuller() * vol * targetPrice * Math.sqrt(elapsedSec);

  // --- Mean reversion (OU process) ---
  const displacement = targetPrice - s.current;
  const reversion = displacement * cfg.reversion * elapsedSec;

  // --- Momentum with exponential decay ---
  // Velocity carries forward, creating multi-tick trends
  const decay = Math.pow(cfg.momentum, elapsedSec);
  s.velocity = s.velocity * decay + shock;

  // --- Price update ---
  let newPrice = s.current + s.velocity + reversion;

  // Soft clamp: don't drift beyond maxDrift from target
  const maxOffset = targetPrice * cfg.maxDrift;
  if (newPrice > targetPrice + maxOffset) {
    newPrice = targetPrice + maxOffset - Math.random() * maxOffset * 0.1;
    s.velocity *= -0.3;
  } else if (newPrice < targetPrice - maxOffset) {
    newPrice = targetPrice - maxOffset + Math.random() * maxOffset * 0.1;
    s.velocity *= -0.3;
  }

  s.current = Math.max(newPrice, 0.0001);
  return s.current;
}

/**
 * Generate synthetic OHLC candle by sampling simulatePrice multiple times.
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
