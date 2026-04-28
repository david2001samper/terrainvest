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

/**
 * Per-phase noise state: position + velocity + burst timer.
 * Creates visible pullbacks and pauses instead of invisible jitter.
 */
interface NoiseState {
  pos: number;
  vel: number;
  nextBurst: number;
}

const noiseStates = new Map<string, NoiseState>();

function getNoiseState(key: string): NoiseState {
  let s = noiseStates.get(key);
  if (!s) {
    s = { pos: 0, vel: 0, nextBurst: 2 + Math.floor(Math.random() * 4) };
    noiseStates.set(key, s);
  }
  return s;
}

/**
 * Ramp noise: frequent small pullbacks that create visible zigzags
 * without unrealistic dollar jumps on high-value assets.
 */
function rampNoise(
  key: string,
  totalDistance: number,
  progress: number
): number {
  const s = getNoiseState(key);
  const absD = Math.abs(totalDistance);

  const randomForce = (Math.random() - 0.5) * absD * 0.012;

  let burstForce = 0;
  s.nextBurst--;
  if (s.nextBurst <= 0) {
    s.nextBurst = 2 + Math.floor(Math.random() * 3);
    const dir =
      Math.random() < 0.7
        ? -Math.sign(totalDistance)
        : Math.sign(totalDistance);
    burstForce = dir * absD * (0.015 + Math.random() * 0.02);
  }

  s.vel = s.vel * 0.50 + randomForce + burstForce;
  s.pos = s.pos * 0.90 + s.vel;

  const cap = absD * 0.14;
  if (s.pos > cap) {
    s.pos = cap;
    s.vel *= -0.35;
  }
  if (s.pos < -cap) {
    s.pos = -cap;
    s.vel *= -0.35;
  }

  const fade =
    Math.min(progress * 5, 1) * Math.min((1 - progress) * 5, 1);

  return s.pos * fade;
}

/**
 * Recovery noise: stronger and more frequent counter-trend bursts so
 * the price visibly fights back (bounces up) as it drops to real price.
 */
function recoveryNoise(
  key: string,
  totalDistance: number,
  progress: number
): number {
  const s = getNoiseState(key);
  const absD = Math.abs(totalDistance);

  const randomForce = (Math.random() - 0.5) * absD * 0.014;

  let burstForce = 0;
  s.nextBurst--;
  if (s.nextBurst <= 0) {
    s.nextBurst = 2 + Math.floor(Math.random() * 2);
    const dir =
      Math.random() < 0.80
        ? -Math.sign(totalDistance)
        : Math.sign(totalDistance);
    burstForce = dir * absD * (0.02 + Math.random() * 0.025);
  }

  s.vel = s.vel * 0.45 + randomForce + burstForce;
  s.pos = s.pos * 0.88 + s.vel;

  const cap = absD * 0.16;
  if (s.pos > cap) {
    s.pos = cap;
    s.vel *= -0.35;
  }
  if (s.pos < -cap) {
    s.pos = -cap;
    s.vel *= -0.35;
  }

  const fade =
    Math.min(progress * 5, 1) * Math.min((1 - progress) * 3, 1);

  return s.pos * fade;
}

/**
 * Hold-phase noise: tiny random walk with strong mean reversion.
 * Price "struggles" at the level with barely-visible oscillations.
 */
function holdNoise(key: string, basePrice: number): number {
  const s = getNoiseState(key);

  const step = (Math.random() - 0.5) * basePrice * 0.0005;
  s.vel = s.vel * 0.3 + step;
  s.pos = s.pos * 0.88 + s.vel;

  const cap = basePrice * 0.0008;
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

    // Anchor the simulation on the LATEST real market price. This is just
    // the initial t=0 anchor for the response & UI; subsequent ticks always
    // re-read the live price so the simulation tracks the market in real
    // time (this is the whole point of the rewrite).
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
    }

    const TICK_INTERVAL_MS = 1000;
    const rampMs = rampSec * 1000;
    const holdMs = holdSec * 1000;
    const recoveryMs = recoverySec * 1000;
    const totalDurationMs = rampMs + holdMs + recoveryMs;
    const startedAt = Date.now();
    const endTime = new Date(startedAt + totalDurationMs + 2_000);

    // Track the most recent real price observed during the simulation.
    // Re-fetched (cached) every tick so movements in the underlying market
    // shift the ramp baseline AND the recovery destination.
    let lastReal = initialReal;

    // Phase 1 frame at t=0: anchor the override at the live price so users
    // don't see an immediate jump from real → start of ramp.
    await upsertOverride(sym, lastReal, endTime, admin.id);

    const interval = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= totalDurationMs) {
        clearInterval(interval);
        return;
      }

      // Refresh the live anchor (cheap — TTL-cached).
      const real = await getCachedRealPrice(sym);
      if (real != null && real > 0) lastReal = real;

      let next: number;

      if (elapsed < rampMs) {
        const progress = easeInOut(elapsed / rampMs);
        const linear = lastReal + (target_price - lastReal) * progress;
        next =
          linear +
          rampNoise(`ramp_${sym}`, target_price - lastReal, progress);
      } else if (elapsed < rampMs + holdMs) {
        next = target_price + holdNoise(`hold_${sym}`, target_price);
      } else {
        const recoveryElapsed = elapsed - rampMs - holdMs;
        const progress = easeInOut(recoveryElapsed / recoveryMs);
        const linear = target_price + (lastReal - target_price) * progress;
        next =
          linear +
          recoveryNoise(
            `recovery_${sym}`,
            lastReal - target_price,
            progress
          );
      }

      try {
        await upsertOverride(sym, next, endTime, admin.id);
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
