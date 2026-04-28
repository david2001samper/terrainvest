import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchRealMarketPrice } from "@/lib/market-price";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

/**
 * Per-symbol handles for an active simulation.
 * `interval` ticks the price; `cleanup` deletes the override at the end.
 */
type SimHandles = {
  interval: NodeJS.Timeout;
  cleanup: NodeJS.Timeout;
};
const activeSimulations = new Map<string, SimHandles>();

async function upsertOverride(
  symbol: string,
  price: number,
  expiresAt: Date,
  adminId: string
) {
  const svc = await createServiceClient();
  await svc.from("price_overrides").upsert(
    {
      symbol,
      override_price: Math.round(price * 100) / 100,
      expires_at: expiresAt.toISOString(),
      created_by: adminId,
    },
    { onConflict: "symbol" }
  );
}

/**
 * Cached "live" price per symbol so we don't hammer CoinGecko/Yahoo at 1Hz.
 * The simulator refetches at most once every REAL_TTL_MS; between fetches
 * it reuses the last value.
 */
const realPriceCache = new Map<string, { price: number; at: number }>();
const REAL_TTL_MS = 5_000;

async function getCachedRealPrice(symbol: string): Promise<number | null> {
  const cached = realPriceCache.get(symbol);
  if (cached && Date.now() - cached.at < REAL_TTL_MS) return cached.price;

  try {
    const live = await fetchRealMarketPrice(symbol);
    if (live != null && live > 0) {
      realPriceCache.set(symbol, { price: live, at: Date.now() });
      return live;
    }
  } catch {
    // network/yfinance failure — fall back to last cached value
  }
  return cached?.price ?? null;
}

const phaseScratch = new Map<string, number>();

// ---------------------------------------------------------------------------
// Trend patterns
//
// Each array is a sequence of completion checkpoints (0 = start, 1 = end of
// phase) with explicit pullbacks (counter-trend dips) between them. Patterns
// are sampled with smoothstep interpolation per segment so each step and
// pullback is visible on the chart instead of getting averaged into a smooth
// curve.
//
// Pullback magnitude per tick is later capped at min(4% of total distance,
// $30) by applyPullbackCap, so BTC ramps never have a >$30 dip regardless
// of pattern.
// ---------------------------------------------------------------------------

// 5 visually distinct ramp shapes for upward moves (target > start).
const RAMP_UP_PATTERNS: number[][] = [
  // 1. GRADUAL — smooth climb, mild ~2% pullbacks
  [0, 0.05, 0.11, 0.09, 0.16, 0.23, 0.21, 0.30, 0.38, 0.36, 0.47, 0.56, 0.54, 0.67, 0.80, 0.78, 1.00],
  // 2. CHOPPY — many medium pullbacks (~3-4%)
  [0, 0.06, 0.04, 0.12, 0.18, 0.14, 0.22, 0.30, 0.25, 0.38, 0.47, 0.43, 0.58, 0.70, 0.66, 0.85, 1.00],
  // 3. STAIRS — plateaus then jumps, no real pullbacks
  [0, 0.08, 0.08, 0.14, 0.24, 0.24, 0.30, 0.42, 0.42, 0.50, 0.62, 0.62, 0.70, 0.84, 0.84, 0.92, 1.00],
  // 4. DEEP DIPS — fewer but more prominent pullbacks (capped at $30)
  [0, 0.12, 0.16, 0.11, 0.24, 0.33, 0.27, 0.40, 0.52, 0.46, 0.60, 0.72, 0.65, 0.80, 0.92, 0.86, 1.00],
  // 5. BACK-LOADED — slow start, fast finish
  [0, 0.02, 0.05, 0.04, 0.09, 0.13, 0.11, 0.18, 0.27, 0.24, 0.38, 0.50, 0.46, 0.65, 0.82, 0.78, 1.00],
];

// 5 visually distinct ramp shapes for downward moves (target < start).
const RAMP_DOWN_PATTERNS: number[][] = [
  // 1. STEADY DRIP — gentle decline with small upward bounces
  [0, 0.04, 0.10, 0.08, 0.15, 0.22, 0.20, 0.28, 0.36, 0.34, 0.45, 0.54, 0.52, 0.65, 0.78, 0.76, 1.00],
  // 2. WHIPSAW — many bounces against the down trend
  [0, 0.07, 0.05, 0.13, 0.20, 0.16, 0.25, 0.33, 0.28, 0.41, 0.50, 0.46, 0.61, 0.72, 0.68, 0.86, 1.00],
  // 3. STEPPED DOWN — drops then plateaus
  [0, 0.07, 0.07, 0.13, 0.22, 0.22, 0.30, 0.42, 0.42, 0.51, 0.63, 0.63, 0.71, 0.83, 0.83, 0.91, 1.00],
  // 4. SHARP LEGS — bigger drops with prominent bounces
  [0, 0.13, 0.18, 0.13, 0.26, 0.35, 0.29, 0.42, 0.54, 0.48, 0.62, 0.74, 0.67, 0.82, 0.93, 0.87, 1.00],
  // 5. HESITANT THEN ACCELERATING
  [0, 0.03, 0.06, 0.04, 0.10, 0.14, 0.12, 0.19, 0.28, 0.25, 0.39, 0.51, 0.47, 0.66, 0.83, 0.79, 1.00],
];

// Recovery patterns: similar shape to ramps but with stronger counter-trend
// "fight back" feel, since price is leaving the override target.
const RECOVERY_UP_PATTERNS: number[][] = [
  // 1. SLOW RECOVERY with resistance
  [0, 0.05, 0.10, 0.07, 0.16, 0.22, 0.18, 0.28, 0.36, 0.32, 0.44, 0.54, 0.50, 0.65, 0.78, 0.74, 1.00],
  // 2. STAGGERED — multiple stalls
  [0, 0.07, 0.05, 0.12, 0.19, 0.15, 0.24, 0.32, 0.27, 0.40, 0.50, 0.45, 0.60, 0.72, 0.67, 0.86, 1.00],
  // 3. STEPPED — plateaus then breakouts
  [0, 0.08, 0.08, 0.16, 0.24, 0.24, 0.32, 0.44, 0.44, 0.52, 0.64, 0.64, 0.72, 0.84, 0.84, 0.92, 1.00],
  // 4. RESISTANCE BOUNCES — frequent rejections
  [0, 0.12, 0.17, 0.10, 0.24, 0.34, 0.27, 0.42, 0.54, 0.46, 0.62, 0.74, 0.66, 0.82, 0.93, 0.85, 1.00],
  // 5. STEADY THEN STRONG
  [0, 0.04, 0.08, 0.06, 0.13, 0.18, 0.15, 0.23, 0.32, 0.28, 0.42, 0.55, 0.50, 0.68, 0.84, 0.79, 1.00],
];

const RECOVERY_DOWN_PATTERNS: number[][] = [
  // 1. CONTROLLED FADE with bounces
  [0, 0.06, 0.11, 0.08, 0.17, 0.24, 0.20, 0.30, 0.38, 0.34, 0.46, 0.56, 0.52, 0.66, 0.79, 0.75, 1.00],
  // 2. STAGGERED DROP — multiple bounces
  [0, 0.08, 0.06, 0.14, 0.21, 0.17, 0.26, 0.34, 0.29, 0.42, 0.52, 0.47, 0.62, 0.74, 0.69, 0.87, 1.00],
  // 3. STEPPED DOWN — bounces then drops
  [0, 0.07, 0.07, 0.15, 0.23, 0.23, 0.31, 0.43, 0.43, 0.51, 0.63, 0.63, 0.71, 0.83, 0.83, 0.91, 1.00],
  // 4. SHARP LEGS WITH RECOVERIES
  [0, 0.13, 0.19, 0.12, 0.26, 0.36, 0.29, 0.44, 0.55, 0.48, 0.63, 0.75, 0.68, 0.83, 0.94, 0.86, 1.00],
  // 5. FAST DROP THEN STABILIZE
  [0, 0.05, 0.10, 0.07, 0.15, 0.20, 0.17, 0.26, 0.34, 0.30, 0.43, 0.56, 0.52, 0.69, 0.85, 0.81, 1.00],
];

// Hold patterns: signed values from -1 to +1 that get scaled to a tiny
// fraction of basePrice. 5 distinct oscillation shapes so consecutive
// holds don't look identical.
const HOLD_PATTERNS: number[][] = [
  // 1. SLOW WIGGLE — symmetric soft oscillation
  [0, 0.3, -0.2, 0.4, -0.3, 0.5, -0.4, 0.3, -0.2, 0.4, -0.3, 0.5, -0.4, 0.3, -0.2, 0.4, 0],
  // 2. RAPID JITTER — alternating quick swings
  [0, 0.5, -0.4, 0.3, -0.5, 0.4, -0.3, 0.5, -0.4, 0.3, -0.5, 0.4, -0.3, 0.5, -0.4, 0.3, 0],
  // 3. DRIFTING UP THEN DOWN — leaning above then below target
  [0, 0.2, 0.4, 0.3, 0.5, 0.4, 0.3, 0.2, 0.0, -0.2, -0.3, -0.4, -0.5, -0.4, -0.3, -0.2, 0],
  // 4. STRUGGLE BELOW THEN ABOVE — leaning below first
  [0, -0.3, -0.5, -0.4, -0.5, -0.3, -0.2, 0, 0.2, 0.3, 0.5, 0.4, 0.5, 0.3, 0.2, 0, 0],
  // 5. ASYMMETRIC — irregular biased wiggles
  [0, 0.4, -0.1, 0.5, -0.2, 0.3, -0.3, 0.2, -0.4, 0.5, 0.2, -0.5, 0.4, -0.2, 0.3, -0.4, 0],
];

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampToRange(n: number, a: number, b: number): number {
  return clamp(n, Math.min(a, b), Math.max(a, b));
}

function pickPatternIndex(max: number): number {
  return Math.floor(Math.random() * max);
}

/**
 * Sample a pattern at a given progress (0..1) using smoothstep interpolation
 * within each segment. Smoothstep (t*t*(3-2*t)) accelerates inside a segment
 * and slows near each checkpoint, which makes individual up-steps and
 * pullbacks visible as discrete moves on the chart instead of being averaged
 * away by linear interpolation.
 */
function samplePattern(pattern: number[], progress: number): number {
  if (pattern.length === 0) return 0;
  if (progress <= 0) return pattern[0];
  if (progress >= 1) return pattern[pattern.length - 1];
  const scaled = progress * (pattern.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const eased = frac * frac * (3 - 2 * frac);
  const a = pattern[i];
  const b = pattern[Math.min(i + 1, pattern.length - 1)];
  return a + (b - a) * eased;
}

/**
 * Cap any single counter-trend movement (a pullback in an up-trend or a
 * bounce in a down-trend) to the smaller of 4% of total distance or $30.
 * This guarantees BTC ramps never have a >$30 reverse step while keeping
 * smaller-distance ramps proportional.
 */
function applyPullbackCap(
  prev: number,
  next: number,
  totalDistance: number
): number {
  if (totalDistance === 0) return next;
  const trendSign = Math.sign(totalDistance);
  const movement = next - prev;
  const isCounterTrend = movement * trendSign < 0;
  if (!isCounterTrend) return next;
  const maxPullback = Math.min(Math.abs(totalDistance) * 0.04, 30);
  if (Math.abs(movement) > maxPullback) {
    return prev - trendSign * maxPullback;
  }
  return next;
}

/**
 * Keeps high-value assets like BTC from jumping unrealistically in a single
 * second while still letting fast ramps catch up to checkpoints.
 */
function limitTickMove(
  previous: number,
  desired: number,
  totalDistance: number,
  phaseSeconds: number,
  referencePrice: number
): number {
  const avgPerSecond = Math.abs(totalDistance) / Math.max(phaseSeconds, 1);
  const priceBasedCap = referencePrice * 0.00042;
  const catchUpCap = avgPerSecond * 1.4;
  const absoluteCap = referencePrice * 0.00050;
  const maxMove = Math.max(
    avgPerSecond * 1.2,
    Math.min(Math.max(priceBasedCap, catchUpCap), absoluteCap)
  );
  return previous + clamp(desired - previous, -maxMove, maxMove);
}

/**
 * Hold-phase oscillation: signed pattern (-1..+1) scaled to ~0.01% of base
 * price, plus tiny random jitter, smoothed across ticks. Final amplitude is
 * clamped to ±0.012% of basePrice (~$9 on BTC at $76k).
 */
function holdNoise(
  key: string,
  basePrice: number,
  progress: number,
  holdPattern: number[]
): number {
  const patternComponent = samplePattern(holdPattern, progress) * basePrice * 0.00010;
  const random = (Math.random() - 0.5) * basePrice * 0.00003;
  const prev = phaseScratch.get(key) ?? 0;
  const next = clamp(
    prev * 0.5 + patternComponent + random,
    -basePrice * 0.00012,
    basePrice * 0.00012
  );
  phaseScratch.set(key, next);
  return next;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const {
      symbol,
      target_price,
      start_price,
      ramp_seconds,
      hold_seconds,
      recovery_seconds,
    } = body as {
      symbol: string;
      target_price: number;
      start_price?: number;
      ramp_seconds: number;
      hold_seconds: number;
      recovery_seconds: number;
    };

    if (!symbol || target_price == null || target_price <= 0) {
      return NextResponse.json(
        { error: "symbol and target_price required" },
        { status: 400 }
      );
    }

    const rampSec = Math.max(5, Math.min(3600, ramp_seconds || 60));
    const holdSec = Math.max(0, Math.min(3600, hold_seconds || 10));
    const recoverySec = Math.max(5, Math.min(3600, recovery_seconds || 30));

    const sym = symbol.toUpperCase();

    // Anchor the ramp on the latest real market price at start. Recovery
    // still re-reads the live price so the final override lands near reality.
    let initialReal: number | null =
      start_price && start_price > 0 ? start_price : null;
    if (!initialReal) initialReal = await getCachedRealPrice(sym);

    if (!initialReal || initialReal <= 0) {
      return NextResponse.json(
        {
          error:
            "Cannot fetch current price for " +
            sym +
            ". Enter a start price manually.",
        },
        { status: 400 }
      );
    }

    // Cancel any previous simulation for this symbol
    const existing = activeSimulations.get(sym);
    if (existing) {
      clearInterval(existing.interval);
      clearTimeout(existing.cleanup);
      activeSimulations.delete(sym);
      phaseScratch.delete(`hold_${sym}`);
    }

    const TICK_INTERVAL_MS = 1000;
    const rampMs = rampSec * 1000;
    const holdMs = holdSec * 1000;
    const recoveryMs = recoverySec * 1000;
    const totalDurationMs = rampMs + holdMs + recoveryMs;
    const startedAt = Date.now();
    const endTime = new Date(startedAt + totalDurationMs + 2_000);

    // Track the most recent real price observed during the simulation.
    // Ramp starts from a fixed anchor so it does not wobble if the live
    // feed moves, while recovery still targets the latest real price.
    const rampStartPrice = initialReal;
    let lastReal = initialReal;
    let lastOverridePrice = initialReal;
    let recoveryStartPrice: number | null = null;
    const rampIsUp = target_price >= rampStartPrice;
    const rampPattern = rampIsUp
      ? RAMP_UP_PATTERNS[pickPatternIndex(RAMP_UP_PATTERNS.length)]
      : RAMP_DOWN_PATTERNS[pickPatternIndex(RAMP_DOWN_PATTERNS.length)];
    let recoveryPattern =
      RECOVERY_DOWN_PATTERNS[pickPatternIndex(RECOVERY_DOWN_PATTERNS.length)];
    const holdPattern = HOLD_PATTERNS[pickPatternIndex(HOLD_PATTERNS.length)];

    // Phase 1 frame at t=0: anchor the override at the live price so users
    // don't see an immediate jump from real → start of ramp.
    await upsertOverride(sym, lastReal, endTime, admin.id);

    const interval = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= totalDurationMs) {
        const finalReal = await getCachedRealPrice(sym);
        if (finalReal != null && finalReal > 0) lastReal = finalReal;
        await upsertOverride(sym, lastReal, endTime, admin.id);
        lastOverridePrice = lastReal;
        clearInterval(interval);
        return;
      }

      // Refresh the live anchor (cheap — TTL-cached).
      const real = await getCachedRealPrice(sym);
      if (real != null && real > 0) lastReal = real;

      let next: number;

      if (elapsed < rampMs) {
        const progress = clamp(elapsed / rampMs, 0, 1);
        const distance = target_price - rampStartPrice;
        const completion = samplePattern(rampPattern, progress);
        next = rampStartPrice + distance * completion;
        next = clampToRange(next, rampStartPrice, target_price);
        next = applyPullbackCap(lastOverridePrice, next, distance);
        next = limitTickMove(
          lastOverridePrice,
          next,
          distance,
          rampSec,
          Math.max(target_price, rampStartPrice)
        );
        next = clampToRange(next, rampStartPrice, target_price);
      } else if (elapsed < rampMs + holdMs) {
        const holdElapsed = elapsed - rampMs;
        const holdProgress = holdMs > 0 ? clamp(holdElapsed / holdMs, 0, 1) : 1;
        next =
          target_price +
          holdNoise(`hold_${sym}`, target_price, holdProgress, holdPattern);
        next = clampToRange(next, target_price * 0.99988, target_price * 1.00012);
      } else {
        if (recoveryStartPrice == null) {
          recoveryStartPrice = lastOverridePrice;
          const recoveryIsUp = lastReal >= recoveryStartPrice;
          recoveryPattern = recoveryIsUp
            ? RECOVERY_UP_PATTERNS[pickPatternIndex(RECOVERY_UP_PATTERNS.length)]
            : RECOVERY_DOWN_PATTERNS[pickPatternIndex(RECOVERY_DOWN_PATTERNS.length)];
        }
        const recoveryElapsed = elapsed - rampMs - holdMs;
        const progress = clamp(recoveryElapsed / recoveryMs, 0, 1);
        const distance = lastReal - recoveryStartPrice;
        const completion = samplePattern(recoveryPattern, progress);
        next = recoveryStartPrice + distance * completion;
        next = clampToRange(next, recoveryStartPrice, lastReal);
        next = applyPullbackCap(lastOverridePrice, next, distance);
        next = limitTickMove(
          lastOverridePrice,
          next,
          distance,
          recoverySec,
          Math.max(recoveryStartPrice, lastReal)
        );
        next = clampToRange(next, recoveryStartPrice, lastReal);
      }

      try {
        await upsertOverride(sym, next, endTime, admin.id);
        lastOverridePrice = next;
      } catch (err) {
        console.error(`Simulation tick failed for ${sym}:`, err);
      }
    }, TICK_INTERVAL_MS);

    // Tear down: drop the override row a few seconds after completion so
    // clients smoothly resume real prices.
    const cleanup = setTimeout(async () => {
      activeSimulations.delete(sym);
      phaseScratch.delete(`hold_${sym}`);
      clearInterval(interval);
      try {
        const svc = await createServiceClient();
        await svc.from("price_overrides").delete().eq("symbol", sym);
      } catch {
        // expire naturally via expires_at
      }
    }, totalDurationMs + 3_000);

    activeSimulations.set(sym, { interval, cleanup });

    return NextResponse.json({
      success: true,
      symbol: sym,
      start_price: Math.round(initialReal * 100) / 100,
      target_price: Math.round(target_price * 100) / 100,
      ramp_seconds: rampSec,
      hold_seconds: holdSec,
      recovery_seconds: recoverySec,
      total_duration_seconds: Math.round(totalDurationMs / 1000),
      tracks_real_price: true,
    });
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get("symbol") ?? "").toUpperCase();

    if (!symbol) {
      return NextResponse.json({ error: "symbol required" }, { status: 400 });
    }

    const handles = activeSimulations.get(symbol);
    if (handles) {
      clearInterval(handles.interval);
      clearTimeout(handles.cleanup);
      activeSimulations.delete(symbol);
      phaseScratch.delete(`hold_${symbol}`);
    }

    await supabase.from("price_overrides").delete().eq("symbol", symbol);

    return NextResponse.json({ success: true, stopped: !!handles });
  } catch (error) {
    console.error("Stop simulation error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
