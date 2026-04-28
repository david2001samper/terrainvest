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

interface MotionState {
  phase: number;
  cycles: number;
  pos: number;
  vel: number;
}

const noiseStates = new Map<string, MotionState>();

function getMotionState(key: string, recovery = false): MotionState {
  let s = noiseStates.get(key);
  if (!s) {
    s = {
      phase: Math.random() * Math.PI * 2,
      cycles: recovery ? 4.5 + Math.random() * 1.2 : 3.5 + Math.random(),
      pos: 0,
      vel: 0,
    };
    noiseStates.set(key, s);
  }
  return s;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampToRange(n: number, a: number, b: number): number {
  return clamp(n, Math.min(a, b), Math.max(a, b));
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
  const priceBasedCap = referencePrice * 0.00055;
  const catchUpCap = avgPerSecond * 1.35;
  const absoluteCap = referencePrice * 0.00095;
  const maxMove = Math.max(
    avgPerSecond * 1.08,
    Math.min(Math.max(priceBasedCap, catchUpCap), absoluteCap)
  );
  return previous + clamp(desired - previous, -maxMove, maxMove);
}

/**
 * Planned resistance overlay: several bounded waves plus a tiny random walk.
 * This creates visible up/down structure during ramps and recoveries while
 * fading to zero at the start/end so the target and real-price endpoints hold.
 */
function resistanceCurve(
  key: string,
  totalDistance: number,
  progress: number,
  recovery = false
): number {
  const s = getMotionState(key, recovery);
  const absD = Math.abs(totalDistance);
  if (absD <= 0) return 0;

  const envelope = Math.min(progress * 4, 1) * Math.min((1 - progress) * 4, 1);
  const p = progress * Math.PI * 2;
  const wave =
    Math.sin(p * s.cycles + s.phase) +
    Math.sin(p * (s.cycles * 1.7) + s.phase * 0.6) * 0.42 +
    Math.sin(p * (s.cycles * 2.35) + s.phase * 1.3) * 0.2;

  const biasAgainstDirection = recovery ? -0.22 : -0.12;
  const waveOffset =
    totalDistance *
    (wave * (recovery ? 0.055 : 0.045) + biasAgainstDirection * 0.03) *
    envelope;

  const randomForce = (Math.random() - 0.5) * absD * (recovery ? 0.004 : 0.003);
  s.vel = s.vel * 0.35 + randomForce;
  s.pos = s.pos * 0.78 + s.vel;

  const randomCap = absD * (recovery ? 0.035 : 0.025);
  s.pos = clamp(s.pos, -randomCap, randomCap);

  const totalCap = absD * (recovery ? 0.11 : 0.09);
  return clamp(waveOffset + s.pos * envelope, -totalCap, totalCap);
}

/**
 * Hold-phase noise: tiny random walk with strong mean reversion.
 * Price "struggles" at the level with barely-visible oscillations.
 */
function holdNoise(key: string, basePrice: number): number {
  const s = getMotionState(key);

  const step = (Math.random() - 0.5) * basePrice * 0.00022;
  s.vel = s.vel * 0.3 + step;
  s.pos = s.pos * 0.88 + s.vel;

  const cap = basePrice * 0.00035;
  if (s.pos > cap) {
    s.pos = cap;
    s.vel *= -0.5;
  }
  if (s.pos < -cap) {
    s.pos = -cap;
    s.vel *= -0.5;
  }

  return s.pos;
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
      noiseStates.delete(`ramp_${sym}`);
      noiseStates.delete(`hold_${sym}`);
      noiseStates.delete(`recovery_${sym}`);
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
        const linear = rampStartPrice + distance * progress;
        next =
          linear +
          resistanceCurve(`ramp_${sym}`, distance, progress, false);
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
        next = target_price + holdNoise(`hold_${sym}`, target_price);
      } else {
        if (recoveryStartPrice == null) recoveryStartPrice = lastOverridePrice;
        const recoveryElapsed = elapsed - rampMs - holdMs;
        const progress = easeInOut(recoveryElapsed / recoveryMs);
        const distance = lastReal - recoveryStartPrice;
        const linear = recoveryStartPrice + distance * progress;
        next =
          linear +
          resistanceCurve(
            `recovery_${sym}`,
            distance,
            progress,
            true
          );
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
      noiseStates.delete(`ramp_${sym}`);
      noiseStates.delete(`hold_${sym}`);
      noiseStates.delete(`recovery_${sym}`);
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
      noiseStates.delete(`ramp_${symbol}`);
      noiseStates.delete(`hold_${symbol}`);
      noiseStates.delete(`recovery_${symbol}`);
    }

    await supabase.from("price_overrides").delete().eq("symbol", symbol);

    return NextResponse.json({ success: true, stopped: !!handles });
  } catch (error) {
    console.error("Stop simulation error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
