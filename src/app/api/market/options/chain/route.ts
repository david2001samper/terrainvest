import { NextResponse, type NextRequest } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  const expiryParam = searchParams.get("expiry");

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const yf = await getYahooFinance();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = { lang: "en-US", formatted: false, region: "US" };
    if (expiryParam) {
      opts.date = parseInt(expiryParam);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await yf.options(symbol, opts);

    if (!result) {
      return NextResponse.json(
        { error: "No options data for " + symbol },
        { status: 404 }
      );
    }

    const expirationDates: number[] = result.expirationDates ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mapContract(c: any, type: "call" | "put") {
      return {
        contractSymbol: c.contractSymbol ?? "",
        strike: c.strike ?? 0,
        expiry: c.expiration
          ? new Date(c.expiration * 1000).toISOString()
          : "",
        type,
        lastPrice: c.lastPrice ?? 0,
        bid: c.bid ?? 0,
        ask: c.ask ?? 0,
        volume: c.volume ?? 0,
        openInterest: c.openInterest ?? 0,
        impliedVolatility: c.impliedVolatility ?? 0,
        inTheMoney: c.inTheMoney ?? false,
      };
    }

    const optionsArr = result.options ?? [];
    const first = optionsArr[0];

    const calls = (first?.calls ?? []).map((c: unknown) =>
      mapContract(c, "call")
    );
    const puts = (first?.puts ?? []).map((c: unknown) =>
      mapContract(c, "put")
    );

    return NextResponse.json(
      { expirationDates, calls, puts, underlyingPrice: result.quote?.regularMarketPrice ?? 0 },
      { headers: { "Cache-Control": "public, max-age=15" } }
    );
  } catch (error) {
    console.error("Options chain error:", error);
    return NextResponse.json(
      { error: "Failed to load options for " + symbol },
      { status: 500 }
    );
  }
}
