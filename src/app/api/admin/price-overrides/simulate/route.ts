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
 * Attempt to generate realistic-looking intermediate prices between
 * startPrice and targetPrice over `steps` ticks.
 *
 * Uses a smoothed sigmoid base curve with layered random noise so
 * the price wanders up and down naturally but always arrives at the
 * target by the final tick.
 */
function generateNaturalPath(
  startPrice: number,
  targetPrice: number,
  steps: number
): number[] {
  if (steps <= 0) return [];
  if (steps === 1) return [targetPrice];

  const diff = targetPrice - startPrice;
  const prices: number[] = [];

  let momentum = 0;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps; // 0→1

    // Sigmoid-shaped progress: slow start, fast middle, slow end
    const sigmoid = 1 / (1 + Math.exp(-10 * (t - 0.5)));
    // Normalize sigmoid so it goes from ~0 to ~1
    const sigStart = 1 / (1 + Math.exp(5));
    const sigEnd = 1 / (1 + Math.exp(-5));
    const progress = (sigmoid - sigStart) / (sigEnd - sigStart);

    const basePrice = startPrice + diff * progress;

    if (i === steps) {
      prices.push(targetPrice);
      continue;
    }

    // Noise that fades out as we approach the target
    const remainingRatio = 1 - t;
    const noiseMagnitude = Math.abs(diff) * 0.04 * remainingRatio;

    // Momentum-based random walk for micro-structure
    momentum = momentum * 0.6 + (Math.random() - 0.5) * 2 * 0.4;
    const noise = momentum * noiseMagnitude;

    // Occasional larger "tick" to simulate market volatility
    const spike =
      Math.random() < 0.08
        ? (Math.random() - 0.5) * Math.abs(diff) * 0.02
        : 0;

    prices.push(basePrice + noise + spike);
  }

  return prices;
}

/**
 * Generate the recovery path from holdPrice back to realPrice.
 * Uses an ease-out curve so it starts moving quickly then slows
 * as it approaches the real price.
 */
function generateRecoveryPath(
  holdPrice: number,
  realPrice: number,
  steps: number
): number[] {
  if (steps <= 0) return [];
  if (steps === 1) return [realPrice];

  const diff = realPrice - holdPrice;
  const prices: number[] = [];
  let momentum = 0;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;

    if (i === steps) {
      prices.push(realPrice);
      continue;
    }

    // Ease-out: fast start, slow finish (1 - (1-t)^3)
    const progress = 1 - Math.pow(1 - t, 3);
    const basePrice = holdPrice + diff * progress;

    const remainingRatio = 1 - t;
    const noiseMagnitude = Math.abs(diff) * 0.03 * remainingRatio;
    momentum = momentum * 0.5 + (Math.random() - 0.5) * 2 * 0.5;
    const noise = momentum * noiseMagnitude;

    prices.push(basePrice + noise);
  }

  return prices;
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
