/**
 * Price simulator — Ornstein-Uhlenbeck process with momentum,
 * volatility clustering, and rotating trend patterns.
 *
 * Each symbol cycles through one of 7 pattern sequences (staircase,
 * pullback, breakout, bleed, etc.) that create realistic micro-trends
 * instead of pure random noise. Hold phases deliberately suppress
 * volatility so the price "struggles" with tiny oscillations.
 *
 * Price is hard-clamped to maxDrift from target — it will never exceed
 * that range. A soft dampening zone starts at 70% of maxDrift to
 * prevent abrupt bounces.
 *
 * Works correctly at any polling interval (1s, 8s, 30s) because all
 * dynamics are dt-scaled.
 */

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface PatternPhase {
  /** Directional bias: -1 (strong down) to +1 (strong up), 0 = hold */
  bias: number;
  /** Relative duration (1 = base unit, varies by asset type) */
  duration: number;
  /** Volatility multiplier (1 = normal, 0.12 = very quiet hold) */
  volScale: number;
}

const PATTERNS: PatternPhase[][] = [
  // 1 — Staircase up: climb, consolidate, climb, shallow dip, recover
  [
    { bias: 0.6,   duration: 2.0, volScale: 0.8 },
    { bias: 0,     duration: 1.2, volScale: 0.12 },
    { bias: 0.7,   duration: 1.5, volScale: 0.9 },
    { bias: -0.25, duration: 1.0, volScale: 0.6 },
    { bias: 0.4,   duration: 1.5, volScale: 0.7 },
  ],
  // 2 — Selloff with dead-cat bounce: drop, tiny bounce, struggle, drop
  [
    { bias: -0.8,  duration: 2.0, volScale: 1.0 },
    { bias: 0.25,  duration: 0.8, volScale: 0.5 },
    { bias: 0,     duration: 1.2, volScale: 0.12 },
    { bias: -0.6,  duration: 2.0, volScale: 0.9 },
    { bias: 0,     duration: 0.6, volScale: 0.12 },
  ],
  // 3 — Rally with pullback: strong push, retrace, consolidate, continue
  [
    { bias: 0.85,  duration: 1.8, volScale: 1.0 },
    { bias: -0.35, duration: 1.0, volScale: 0.7 },
    { bias: 0,     duration: 1.2, volScale: 0.12 },
    { bias: 0.5,   duration: 1.5, volScale: 0.8 },
  ],
  // 4 — Slow bleed: gradual decline, struggle, another leg down, weak bounce
  [
    { bias: -0.4,  duration: 2.5, volScale: 0.7 },
    { bias: 0,     duration: 1.2, volScale: 0.12 },
    { bias: -0.5,  duration: 2.0, volScale: 0.8 },
    { bias: 0.15,  duration: 0.8, volScale: 0.4 },
    { bias: 0,     duration: 1.0, volScale: 0.12 },
  ],
  // 5 — Accumulation range: up, hold, down, hold (choppy sideways)
  [
    { bias: 0.35,  duration: 1.5, volScale: 0.6 },
    { bias: 0,     duration: 1.2, volScale: 0.12 },
    { bias: -0.35, duration: 1.5, volScale: 0.6 },
    { bias: 0,     duration: 1.2, volScale: 0.12 },
  ],
  // 6 — Breakout and fade: sharp spike, hold at top, slow drift down
  [
    { bias: 0.9,   duration: 1.0, volScale: 1.1 },
    { bias: 0,     duration: 1.5, volScale: 0.12 },
    { bias: -0.25, duration: 3.0, volScale: 0.5 },
  ],
  // 7 — Capitulation and grind: sharp drop, bottom out, slow recovery
  [
    { bias: -0.9,  duration: 1.0, volScale: 1.1 },
    { bias: 0,     duration: 1.5, volScale: 0.12 },
    { bias: 0.25,  duration: 3.0, volScale: 0.5 },
  ],
];

// ---------------------------------------------------------------------------
// State & dynamics
// ---------------------------------------------------------------------------

interface SymbolState {
  current: number;
  target: number;
  velocity: number;
  volState: number;
  lastTick: number;
  patternIdx: number;
  phaseIdx: number;
  phaseElapsed: number;
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
  /** Seconds per 1× duration unit in a pattern phase */
  phaseBaseSec: number;
}

const DYNAMICS: Record<string, AssetDynamics> = {
  crypto:    { vol: 0.0010,  reversion: 0.06, momentum: 0.88, maxDrift: 0.018, phaseBaseSec: 25 },
  stock:     { vol: 0.00050, reversion: 0.08, momentum: 0.85, maxDrift: 0.012, phaseBaseSec: 28 },
  commodity: { vol: 0.00065, reversion: 0.07, momentum: 0.86, maxDrift: 0.014, phaseBaseSec: 26 },
  index:     { vol: 0.00035, reversion: 0.10, momentum: 0.82, maxDrift: 0.008, phaseBaseSec: 30 },
  forex:     { vol: 0.00020, reversion: 0.12, momentum: 0.80, maxDrift: 0.005, phaseBaseSec: 35 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function boxMuller(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function pickRandomPattern(excludeIdx?: number): number {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * PATTERNS.length);
  } while (PATTERNS.length > 1 && idx === excludeIdx);
  return idx;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

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
      patternIdx: pickRandomPattern(),
      phaseIdx: 0,
      phaseElapsed: 0,
    };
    states.set(key, s);
    return targetPrice;
  }

  const cfg = DYNAMICS[assetType] || DYNAMICS.stock;

  const elapsedSec = Math.min((Date.now() - s.lastTick) / 1000, 10);
  s.lastTick = Date.now();
  s.target = targetPrice;

  // --- Advance pattern phase -----------------------------------------------
  let pattern = PATTERNS[s.patternIdx];
  s.phaseElapsed += elapsedSec;

  const phaseDurationSec = pattern[s.phaseIdx].duration * cfg.phaseBaseSec;
  if (s.phaseElapsed >= phaseDurationSec) {
    s.phaseElapsed = 0;
    s.phaseIdx++;
    if (s.phaseIdx >= pattern.length) {
      s.phaseIdx = 0;
      s.patternIdx = pickRandomPattern(s.patternIdx);
      pattern = PATTERNS[s.patternIdx];
    }
  }

  const phase = pattern[s.phaseIdx];
  const isHold = phase.volScale < 0.2;

  // --- Volatility clustering (GARCH-like) ----------------------------------
  const volImpulse = 0.4 + Math.abs(boxMuller()) * 0.6;
  s.volState = s.volState * 0.93 + volImpulse * 0.07;
  const vol = cfg.vol * s.volState * phase.volScale;

  // --- Random shock (scaled by √dt) ----------------------------------------
  const shock = boxMuller() * vol * targetPrice * Math.sqrt(elapsedSec);

  // --- Directional bias from current pattern phase -------------------------
  const biasForce = phase.bias * cfg.maxDrift * targetPrice * elapsedSec * 0.02;

  // --- Mean reversion (OU process) -----------------------------------------
  const displacement = targetPrice - s.current;
  const revStrength = isHold ? cfg.reversion * 3 : cfg.reversion;
  const reversion = displacement * revStrength * elapsedSec;

  // --- Momentum with decay -------------------------------------------------
  const baseMomentum = Math.pow(cfg.momentum, elapsedSec);
  const momentumDecay = isHold ? baseMomentum * 0.25 : baseMomentum;
  s.velocity = s.velocity * momentumDecay + shock + biasForce;

  // --- Price update --------------------------------------------------------
  let newPrice = s.current + s.velocity + reversion;

  // --- Hard clamp: NEVER exceed maxDrift from target -----------------------
  const maxOffset = targetPrice * cfg.maxDrift;
  const upperBound = targetPrice + maxOffset;
  const lowerBound = targetPrice - maxOffset;

  if (newPrice >= upperBound) {
    newPrice = upperBound - Math.random() * maxOffset * 0.05;
    s.velocity = -Math.abs(s.velocity) * 0.12;
  } else if (newPrice <= lowerBound) {
    newPrice = lowerBound + Math.random() * maxOffset * 0.05;
    s.velocity = Math.abs(s.velocity) * 0.12;
  }

  // Soft dampening zone: start slowing down past 70% of maxDrift
  const distFromTarget = Math.abs(newPrice - targetPrice);
  const driftRatio = distFromTarget / maxOffset;
  if (driftRatio > 0.7) {
    const dampening = 1 - ((driftRatio - 0.7) / 0.3) * 0.6;
    s.velocity *= dampening;
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
