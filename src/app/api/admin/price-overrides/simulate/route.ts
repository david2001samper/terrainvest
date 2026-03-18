import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

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

const activeSimulations = new Map<string, NodeJS.Timeout[]>();

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
 * Generate a natural-looking price path from startPrice to targetPrice.
 *
 * Works in progress space (0 = start, 1 = target). A soft correction
 * pulls progress toward a linear timeline while random noise makes it
 * bounce up and down. A hard ceiling guarantees progress NEVER reaches
 * 1.0 (the target) until the very last tick.
 *
 * All scaling is derived from the price difference and step count:
 *   - Large diff + few steps  → bigger per-tick moves
 *   - Small diff + many steps → tiny per-tick moves
 *   - Noise amplitude shrinks toward the end for a smooth landing
 */
function generateNaturalPath(
  startPrice: number,
  targetPrice: number,
  steps: number
): number[] {
  if (steps <= 0) return [];
  if (steps === 1) return [targetPrice];

  const totalDrift = targetPrice - startPrice;
  const prices: number[] = [];
  let progress = 0; // 0 = at startPrice, 1 = at targetPrice

  for (let i = 1; i <= steps; i++) {
    // Last tick always snaps to target
    if (i === steps) {
      prices.push(targetPrice);
      break;
    }

    const t = i / steps;
    const remaining = steps - i;

    // Where progress should ideally be on a linear timeline
    const ideal = t;
    const error = ideal - progress;

    // Correction: gently pull toward the linear path, stronger near end
    const pullStrength = 0.15 + 0.35 * t;
    const correction = error * pullStrength;

    // Random noise: average size = one step worth of progress
    // Amplitude decays toward end so the price converges smoothly
    const baseAmp = 1.0 / steps;
    const decay = 1.0 - t * 0.6;
    const noise = (Math.random() - 0.5) * 2 * baseAmp * decay;

    progress += correction + noise;

    // === HARD CEILING: progress can NEVER reach 1.0 before the last tick ===
    // The ceiling rises gradually in the final ticks for a smooth landing
    const ceiling = remaining <= 5
      ? 1.0 - remaining * 0.015 // last 5: 0.925 → 0.94 → 0.955 → 0.97 → 0.985
      : 0.90;
    // Floor: allow small bounce past start but not too far
    const floor = -0.05;

    progress = Math.max(floor, Math.min(ceiling, progress));

    prices.push(startPrice + progress * totalDrift);
  }

  return prices;
}

/**
 * Recovery path: same algorithm in reverse (from hold price back to real).
 */
function generateRecoveryPath(
  holdPrice: number,
  realPrice: number,
  steps: number
): number[] {
  return generateNaturalPath(holdPrice, realPrice, steps);
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

    // Get current price: use admin-provided start_price, or try fetching it
    let currentPrice = start_price && start_price > 0 ? start_price : null;

    if (!currentPrice) {
      try {
        const { fetchMarketPrice } = await import("@/lib/market-price");
        currentPrice = await fetchMarketPrice(sym);
      } catch { /* continue */ }
    }

    // Fallback: try CoinGecko directly
    if (!currentPrice) {
      try {
        const cgIds: Record<string, string> = {
          BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
          ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot", AVAX: "avalanche-2",
          MATIC: "matic-network", LINK: "chainlink",
        };
        if (cgIds[sym]) {
          const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds[sym]}&vs_currencies=usd`,
            { cache: "no-store" }
          );
          if (res.ok) {
            const d = await res.json();
            currentPrice = d[cgIds[sym]]?.usd ?? null;
          }
        }
      } catch { /* continue */ }
    }

    // Fallback: try Yahoo Finance directly
    if (!currentPrice) {
      try {
        const { getYahooFinance } = await import("@/lib/yahoo");
        const yf = await getYahooFinance();
        const quote = await yf.quote(sym);
        currentPrice = quote.regularMarketPrice ?? null;
      } catch { /* continue */ }
    }

    if (!currentPrice || currentPrice <= 0) {
      return NextResponse.json(
        { error: "Cannot fetch current price for " + sym + ". Enter a start price manually." },
        { status: 400 }
      );
    }

    // Cancel any existing simulation for this symbol
    const existing = activeSimulations.get(sym);
    if (existing) {
      existing.forEach(clearTimeout);
      activeSimulations.delete(sym);
    }

    const TICK_INTERVAL_MS = 2000; // update price every 2s
    const rampTicks = Math.max(1, Math.round((rampSec * 1000) / TICK_INTERVAL_MS));
    const holdTicks = Math.max(0, Math.round((holdSec * 1000) / TICK_INTERVAL_MS));
    const recoveryTicks = Math.max(1, Math.round((recoverySec * 1000) / TICK_INTERVAL_MS));

    const totalTicks = rampTicks + holdTicks + recoveryTicks;
    const totalDurationMs = totalTicks * TICK_INTERVAL_MS;
    const endTime = new Date(Date.now() + totalDurationMs + 2000);

    // Phase 1: ramp from current price to target
    const rampPrices = generateNaturalPath(currentPrice, target_price, rampTicks);

    // Phase 2: hold at target with tiny fluctuations
    const holdPrices: number[] = [];
    for (let i = 0; i < holdTicks; i++) {
      const jitter = target_price * 0.001 * (Math.random() - 0.5);
      holdPrices.push(target_price + jitter);
    }

    // Phase 3: recover from target back to real price
    const recoveryPrices = generateRecoveryPath(
      target_price,
      currentPrice,
      recoveryTicks
    );

    const allPrices = [...rampPrices, ...holdPrices, ...recoveryPrices];

    const timers: NodeJS.Timeout[] = [];

    // Set the first price immediately
    await upsertOverride(sym, allPrices[0], endTime, admin.id);

    // Schedule each subsequent tick
    for (let i = 1; i < allPrices.length; i++) {
      const delayMs = i * TICK_INTERVAL_MS;
      const p = allPrices[i];

      const timer = setTimeout(async () => {
        try {
          await upsertOverride(sym, p, endTime, admin.id);
        } catch (err) {
          console.error(`Simulation tick ${i} failed for ${sym}:`, err);
        }
      }, delayMs);

      timers.push(timer);
    }

    // Cleanup: remove override after everything finishes (let it expire naturally)
    const cleanupTimer = setTimeout(async () => {
      activeSimulations.delete(sym);
      try {
        const svc = await createServiceClient();
        await svc.from("price_overrides").delete().eq("symbol", sym);
      } catch { /* expire naturally */ }
    }, totalDurationMs + 3000);
    timers.push(cleanupTimer);

    activeSimulations.set(sym, timers);

    return NextResponse.json({
      success: true,
      symbol: sym,
      start_price: Math.round(currentPrice * 100) / 100,
      target_price: Math.round(target_price * 100) / 100,
      ramp_seconds: rampSec,
      hold_seconds: holdSec,
      recovery_seconds: recoverySec,
      total_ticks: allPrices.length,
      total_duration_seconds: Math.round(totalDurationMs / 1000),
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

    const timers = activeSimulations.get(symbol);
    if (timers) {
      timers.forEach(clearTimeout);
      activeSimulations.delete(symbol);
    }

    await supabase.from("price_overrides").delete().eq("symbol", symbol);

    return NextResponse.json({ success: true, stopped: !!timers });
  } catch (error) {
    console.error("Stop simulation error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
