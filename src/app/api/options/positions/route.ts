import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Auto-expire positions past their expiry date
    const now = new Date().toISOString();
    await supabase
      .from("options_positions")
      .update({
        status: "expired",
        realized_pnl: 0,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("status", "open")
      .lt("expiry", now);

    const { data, error } = await supabase
      .from("options_positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Try to refresh current premiums from Yahoo for each underlying
    const positions = data ?? [];
    if (positions.length > 0) {
      try {
        const { getYahooFinance } = await import("@/lib/yahoo");
        const yf = await getYahooFinance();

        const underlyings = [...new Set(positions.map((p) => p.underlying_symbol))];

        for (const underlying of underlyings) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result: any = await yf.options(underlying);
            if (!result?.options?.[0]) continue;

            const allContracts = [
              ...(result.options[0].calls ?? []),
              ...(result.options[0].puts ?? []),
            ];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const contractMap = new Map<string, any>();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const c of allContracts) {
              contractMap.set(c.contractSymbol, c);
            }

            for (const pos of positions) {
              if (pos.underlying_symbol !== underlying) continue;
              const contract = contractMap.get(pos.contract_symbol);
              if (contract && contract.lastPrice > 0) {
                pos.current_premium = contract.lastPrice;
                supabase
                  .from("options_positions")
                  .update({
                    current_premium: contract.lastPrice,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", pos.id)
                  .then(() => {});
              }
            }
          } catch {
            // Skip if Yahoo fails for this underlying
          }
        }
      } catch {
        // Yahoo unavailable, use stored premiums
      }
    }

    return NextResponse.json(positions);
  } catch (e) {
    console.error("Options positions error:", e);
    return NextResponse.json([], { status: 500 });
  }
}
