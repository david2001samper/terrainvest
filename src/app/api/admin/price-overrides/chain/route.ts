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

interface ChainStep {
  price: number;
  duration: number;
}

const activeChains = new Map<string, NodeJS.Timeout[]>();

async function upsertOverride(
  symbol: string,
  price: number,
  expiresAt: Date,
  adminId: string
) {
  const svc = await createServiceClient();
  await svc
    .from("price_overrides")
    .upsert(
      {
        symbol,
        override_price: price,
        expires_at: expiresAt.toISOString(),
        created_by: adminId,
      },
      { onConflict: "symbol" }
    );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { symbol, steps } = body as { symbol: string; steps: ChainStep[] };

    if (!symbol || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: "symbol and steps[] required" },
        { status: 400 }
      );
    }

    const validSteps = steps.filter(
      (s) => s.price > 0 && s.duration > 0 && s.duration <= 3600
    );
    if (validSteps.length === 0) {
      return NextResponse.json(
        { error: "No valid steps provided" },
        { status: 400 }
      );
    }

    const sym = symbol.toUpperCase();

    const existing = activeChains.get(sym);
    if (existing) {
      existing.forEach(clearTimeout);
      activeChains.delete(sym);
    }

    const totalDuration = validSteps.reduce((sum, s) => sum + s.duration, 0);
    const chainEnd = new Date(Date.now() + totalDuration * 1000);
    const timers: NodeJS.Timeout[] = [];

    await upsertOverride(sym, validSteps[0].price, chainEnd, admin.id);

    let elapsed = 0;
    for (let i = 1; i < validSteps.length; i++) {
      elapsed += validSteps[i - 1].duration;
      const step = validSteps[i];
      const delayMs = elapsed * 1000;

      const timer = setTimeout(async () => {
        try {
          await upsertOverride(sym, step.price, chainEnd, admin.id);
        } catch (err) {
          console.error(`Chain step ${i + 1} failed for ${sym}:`, err);
        }
      }, delayMs);

      timers.push(timer);
    }

    const cleanupTimer = setTimeout(() => {
      activeChains.delete(sym);
    }, totalDuration * 1000 + 1000);
    timers.push(cleanupTimer);

    activeChains.set(sym, timers);

    return NextResponse.json({
      success: true,
      symbol: sym,
      steps: validSteps.length,
      total_duration: totalDuration,
    });
  } catch (error) {
    console.error("Chain error:", error);
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
      return NextResponse.json(
        { error: "symbol required" },
        { status: 400 }
      );
    }

    const timers = activeChains.get(symbol);
    if (timers) {
      timers.forEach(clearTimeout);
      activeChains.delete(symbol);
    }

    await supabase
      .from("price_overrides")
      .delete()
      .eq("symbol", symbol);

    return NextResponse.json({ success: true, stopped: !!timers });
  } catch (error) {
    console.error("Stop chain error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
