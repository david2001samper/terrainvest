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

/**
 * Smooth easing so the ramp doesn't feel mechanically linear.
 * Cubic ease-in-out: slow start → fast middle → slow finish.
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const phaseScratch = new Map<string, number>();

const RAMP_PATTERNS_UP: number[][] = [
  [0.0, 0.08, 0.13, 0.12, 0.20, 0.30, 0.28, 0.39, 0.48, 0.46, 0.58, 0.68, 0.66, 0.79, 0.9, 0.88, 1.0],
  [0.0, 0.07, 0.11, 0.1, 0.18, 0.25, 0.23, 0.34, 0.43, 0.41, 0.53, 0.61, 0.59, 0.72, 0.82, 0.8, 1.0],
  [0.0, 0.09, 0.15, 0.14, 0.24, 0.35, 0.33, 0.44, 0.55, 0.53, 0.63, 0.73, 0.71, 0.83, 0.93, 0.91, 1.0],
  [0.0, 0.06, 0.1, 0.09, 0.16, 0.22, 0.2, 0.3, 0.38, 0.36, 0.49, 0.58, 0.56, 0.69, 0.81, 0.79, 1.0],
  [0.0, 0.08, 0.14, 0.13, 0.22, 0.29, 0.27, 0.37, 0.46, 0.44, 0.56, 0.64, 0.62, 0.75, 0.87, 0.85, 1.0],
];

const RAMP_PATTERNS_DOWN: number[][] = [
  [0.0, 0.1, 0.16, 0.15, 0.25, 0.34, 0.32, 0.43, 0.52, 0.5, 0.62, 0.71, 0.69, 0.81, 0.91, 0.89, 1.0],
  [0.0, 0.09, 0.14, 0.13, 0.22, 0.31, 0.29, 0.4, 0.49, 0.47, 0.6, 0.68, 0.66, 0.78, 0.88, 0.86, 1.0],
  [0.0, 0.11, 0.18, 0.17, 0.27, 0.36, 0.34, 0.46, 0.57, 0.55, 0.66, 0.75, 0.73, 0.84, 0.94, 0.92, 1.0],
  [0.0, 0.08, 0.13, 0.12, 0.2, 0.28, 0.26, 0.37, 0.45, 0.43, 0.56, 0.65, 0.63, 0.76, 0.87, 0.85, 1.0],
  [0.0, 0.1, 0.15, 0.14, 0.24, 0.32, 0.3, 0.42, 0.51, 0.49, 0.61, 0.7, 0.68, 0.8, 0.9, 0.88, 1.0],
];

const RECOVERY_PATTERNS_UP: number[][] = [
  [0.0, 0.08, 0.14, 0.11, 0.24, 0.31, 0.27, 0.4, 0.48, 0.44, 0.58, 0.66, 0.63, 0.77, 0.88, 0.85, 1.0],
  [0.0, 0.07, 0.13, 0.1, 0.22, 0.29, 0.25, 0.38, 0.46, 0.42, 0.55, 0.64, 0.61, 0.75, 0.87, 0.84, 1.0],
  [0.0, 0.09, 0.15, 0.12, 0.26, 0.34, 0.3, 0.43, 0.52, 0.48, 0.61, 0.69, 0.66, 0.8, 0.91, 0.88, 1.0],
  [0.0, 0.08, 0.12, 0.1, 0.2, 0.27, 0.23, 0.35, 0.43, 0.39, 0.53, 0.62, 0.59, 0.73, 0.85, 0.82, 1.0],
  [0.0, 0.09, 0.14, 0.12, 0.23, 0.3, 0.26, 0.39, 0.47, 0.43, 0.57, 0.65, 0.62, 0.76, 0.88, 0.85, 1.0],
];

const RECOVERY_PATTERNS_DOWN: number[][] = [
  [0.0, 0.09, 0.16, 0.12, 0.27, 0.35, 0.3, 0.45, 0.54, 0.49, 0.64, 0.73, 0.69, 0.83, 0.93, 0.89, 1.0],
  [0.0, 0.08, 0.15, 0.11, 0.25, 0.33, 0.28, 0.42, 0.51, 0.46, 0.62, 0.71, 0.67, 0.81, 0.92, 0.88, 1.0],
  [0.0, 0.1, 0.17, 0.13, 0.29, 0.37, 0.32, 0.47, 0.56, 0.51, 0.66, 0.75, 0.71, 0.85, 0.95, 0.91, 1.0],
  [0.0, 0.08, 0.14, 0.1, 0.23, 0.31, 0.26, 0.4, 0.49, 0.44, 0.59, 0.68, 0.64, 0.79, 0.9, 0.86, 1.0],
  [0.0, 0.09, 0.16, 0.12, 0.26, 0.34, 0.29, 0.44, 0.53, 0.48, 0.63, 0.72, 0.68, 0.82, 0.93, 0.89, 1.0],
];

const HOLD_PATTERNS: number[][] = [
  [0.0, 0.35, 0.12, 0.42, 0.16, 0.45, 0.2, 0.5, 0.24, 0.52, 0.3, 0.55, 0.28, 0.5, 0.18, 0.35, 0.0],
  [0.0, 0.28, 0.1, 0.33, 0.15, 0.38, 0.2, 0.41, 0.24, 0.43, 0.26, 0.4, 0.22, 0.34, 0.14, 0.25, 0.0],
  [0.0, 0.4, 0.16, 0.45, 0.2, 0.5, 0.23, 0.52, 0.28, 0.55, 0.3, 0.5, 0.25, 0.44, 0.18, 0.32, 0.0],
  [0.0, 0.25, 0.08, 0.3, 0.12, 0.35, 0.16, 0.38, 0.2, 0.4, 0.18, 0.34, 0.15, 0.28, 0.1, 0.2, 0.0],
  [0.0, 0.32, 0.11, 0.37, 0.15, 0.43, 0.18, 0.47, 0.23, 0.5, 0.2, 0.44, 0.16, 0.36, 0.12, 0.24, 0.0],
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

function samplePattern(pattern: number[], progress: number): number {
  if (pattern.length === 0) return 0;
  if (progress <= 0) return pattern[0];
  if (progress >= 1) return pattern[pattern.length - 1];
  const scaled = progress * (pattern.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const a = pattern[i];
  const b = pattern[Math.min(i + 1, pattern.length - 1)];
  return a + (b - a) * frac;
}

/**
 * Keeps BTC-like assets from jumping $100-$200 in one tick while still
 * allowing short recoveries to actually reach the real price.
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
  const catchUpCap = avgPerSecond * 1.55;
  const absoluteCap = referencePrice * 0.00075;
  const maxMove = Math.max(
    avgPerSecond * 1.2,
    Math.min(Math.max(priceBasedCap, catchUpCap), absoluteCap)
  );
  return previous + clamp(desired - previous, -maxMove, maxMove);
}

/**
 * Hold-phase noise: tiny random walk with strong mean reversion.
 * Price "struggles" at the level with barely-visible oscillations.
 */
function holdNoise(
  key: string,
  basePrice: number,
  progress: number,
  holdPattern: number[]
): number {
  const patternComponent = samplePattern(holdPattern, progress) * basePrice * 0.00014;
  const random = (Math.random() - 0.5) * basePrice * 0.00005;
  const prev = phaseScratch.get(key) ?? 0;
  const next = clamp(prev * 0.45 + patternComponent + random, -basePrice * 0.00028, basePrice * 0.00028);
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
      ? RAMP_PATTERNS_UP[pickPatternIndex(RAMP_PATTERNS_UP.length)]
      : RAMP_PATTERNS_DOWN[pickPatternIndex(RAMP_PATTERNS_DOWN.length)];
    let recoveryPattern =
      RECOVERY_PATTERNS_DOWN[pickPatternIndex(RECOVERY_PATTERNS_DOWN.length)];
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
        const progress = easeInOut(elapsed / rampMs);
        const distance = target_price - rampStartPrice;
        const completion = samplePattern(rampPattern, progress);
        next = rampStartPrice + distance * completion;
        next = clampToRange(next, rampStartPrice, target_price);
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
        next = clampToRange(next, target_price * 0.99972, target_price * 1.00028);
      } else {
        if (recoveryStartPrice == null) {
          recoveryStartPrice = lastOverridePrice;
          const recoveryIsUp = lastReal >= recoveryStartPrice;
          recoveryPattern = recoveryIsUp
            ? RECOVERY_PATTERNS_UP[pickPatternIndex(RECOVERY_PATTERNS_UP.length)]
            : RECOVERY_PATTERNS_DOWN[pickPatternIndex(RECOVERY_PATTERNS_DOWN.length)];
        }
        const recoveryElapsed = elapsed - rampMs - holdMs;
        const progress = easeInOut(recoveryElapsed / recoveryMs);
        const distance = lastReal - recoveryStartPrice;
        const completion = samplePattern(recoveryPattern, progress);
        next = recoveryStartPrice + distance * completion;
        next = clampToRange(next, recoveryStartPrice, lastReal);
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
