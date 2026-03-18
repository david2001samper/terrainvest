import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("price_overrides")
      .select("symbol, expires_at")
      .gt("expires_at", new Date().toISOString());

    const overrides = data ?? [];
    if (overrides.length === 0) {
      return NextResponse.json({ active: false, symbols: [], refresh_ms: null });
    }

    const symbols = overrides.map((r) => r.symbol.toUpperCase());

    return NextResponse.json({
      active: true,
      symbols,
      refresh_ms: 2000,
    });
  } catch {
    return NextResponse.json({ active: false, symbols: [], refresh_ms: null });
  }
}
