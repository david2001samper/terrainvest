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
 * State-machine price path with realistic resistance patterns.
 *
 * Cycles through TREND → PULLBACK → HOLD phases. Pullback sizes are
 * proportional to the TOTAL price distance (not per-tick), making
 * resistance clearly visible. The price never crosses start or target.
 *
 * BTC 73,000 → 72,500 (60 ticks) example:
 *   73000 → 72920 → 72860 → 72900(↑pullback) → 72910(↑) →
 *   72840 → 72780 → 72780(hold) → 72720 → 72660 → 72700(↑) →
 *   72630 → 72580 → 72540 → 72500
 */
function generateNaturalPath(
  startPrice: number,
  targetPrice: number,
  steps: number
): number[] {
  if (steps <= 0) return [];
  if (steps === 1) return [targetPrice];

  const totalDist = targetPrice - startPrice;
  const absDist = Math.abs(totalDist);
  const direction = totalDist > 0 ? 1 : -1;

  if (absDist < 0.0001) {
    return Array.from({ length: steps }, () =>
      startPrice + startPrice * 0.0001 * (Math.random() - 0.5)
    );
  }

  const prices: number[] = [];
  let current = startPrice;

  const pullbackMin = absDist * 0.06;
  const pullbackMax = absDist * 0.16;

  type Phase = "trend" | "pullback" | "hold";
  let phase: Phase = "trend";
  let phaseTicksLeft = 2 + Math.floor(Math.random() * 2);
  let currentPullbackSize = 0;

  for (let i = 0; i < steps; i++) {
    if (i === steps - 1) {
      prices.push(targetPrice);
      break;
    }

    const remaining = steps - i;
    const distLeftAbs = Math.abs(targetPrice - current);
    const avgStepMag = distLeftAbs / remaining;
    const nearEnd = remaining <= Math.max(4, Math.ceil(steps * 0.12));

    let move: number;

    if (phase === "trend") {
      const scale = nearEnd
        ? 1.2 + Math.random() * 0.8
        : 0.7 + Math.random() * 1.3;
      move = direction * avgStepMag * scale;
    } else if (phase === "pullback") {
      const perTick = currentPullbackSize / Math.max(1, phaseTicksLeft + 1);
      const jitter = perTick * (0.6 + Math.random() * 0.8);
      move = -direction * jitter;
    } else {
      move = absDist * 0.001 * (Math.random() - 0.5);
    }

    current += move;

    if (direction > 0) {
      current = Math.min(current, targetPrice);
      current = Math.max(current, startPrice - absDist * 0.01);
    } else {
      current = Math.max(current, targetPrice);
      current = Math.min(current, startPrice + absDist * 0.01);
    }

    prices.push(current);

    phaseTicksLeft--;
    if (phaseTicksLeft <= 0) {
      if (nearEnd) {
        phase = "trend";
        phaseTicksLeft = remaining;
      } else {
        const roll = Math.random();
        switch (phase) {
          case "trend":
            if (roll < 0.28) {
              phase = "pullback";
              phaseTicksLeft = 1 + (Math.random() < 0.4 ? 1 : 0);
              currentPullbackSize =
                pullbackMin + Math.random() * (pullbackMax - pullbackMin);
            } else if (roll < 0.40) {
              phase = "hold";
              phaseTicksLeft = 1;
            } else {
              phase = "trend";
              phaseTicksLeft = 2 + Math.floor(Math.random() * 2);
            }
            break;
          case "pullback":
            if (roll < 0.75) {
              phase = "trend";
              phaseTicksLeft = 2 + Math.floor(Math.random() * 3);
            } else {
              phase = "hold";
              phaseTicksLeft = 1;
            }
            break;
          case "hold":
            phase = "trend";
            phaseTicksLeft = 2 + Math.floor(Math.random() * 2);
            break;
        }
      }
    }
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

    const TICK_INTERVAL_MS = 1000;
    const rampTicks = Math.max(1, Math.round((rampSec * 1000) / TICK_INTERVAL_MS));
    const holdTicks = Math.max(0, Math.round((holdSec * 1000) / TICK_INTERVAL_MS));
    const recoveryTicks = Math.max(1, Math.round((recoverySec * 1000) / TICK_INTERVAL_MS));

    const totalTicks = rampTicks + holdTicks + recoveryTicks;
    const totalDurationMs = totalTicks * TICK_INTERVAL_MS;
    const endTime = new Date(Date.now() + totalDurationMs + 2000);

    // Phase 1: ramp from current price to target with resistance waves
    const rampPrices = generateNaturalPath(currentPrice, target_price, rampTicks);

    // Phase 2: hold near target with natural-looking oscillation
    const holdPrices: number[] = [];
    const holdRange = Math.abs(target_price - currentPrice) * 0.04;
    let holdCurrent = rampPrices.length > 0
      ? rampPrices[rampPrices.length - 1]
      : target_price;
    for (let i = 0; i < holdTicks; i++) {
      const drift = (target_price - holdCurrent) * 0.15;
      const noise = holdRange * (Math.random() - 0.5) * 0.6;
      holdCurrent += drift + noise;
      const minH = Math.min(target_price, currentPrice);
      const maxH = Math.max(target_price, currentPrice);
      const buffer = holdRange * 2;
      holdCurrent = Math.max(minH - buffer, Math.min(maxH + buffer, holdCurrent));
      holdPrices.push(holdCurrent);
    }

    // Phase 3: recover from target back to real price with resistance waves
    const recoveryPrices = generateNaturalPath(
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
