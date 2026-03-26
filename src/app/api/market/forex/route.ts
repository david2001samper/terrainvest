import { NextResponse } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";

const FOREX_SYMBOLS = [
  { symbol: "EURUSD=X", name: "EUR/USD" },
  { symbol: "GBPUSD=X", name: "GBP/USD" },
  { symbol: "USDJPY=X", name: "USD/JPY" },
  { symbol: "AUDUSD=X", name: "AUD/USD" },
  { symbol: "USDCHF=X", name: "USD/CHF" },
  { symbol: "USDCAD=X", name: "USD/CAD" },
  { symbol: "NZDUSD=X", name: "NZD/USD" },
  { symbol: "EURGBP=X", name: "EUR/GBP" },
  { symbol: "EURJPY=X", name: "EUR/JPY" },
  { symbol: "GBPJPY=X", name: "GBP/JPY" },
];

interface RawForex {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume: number;
  marketCap: number;
  high24h: number;
  low24h: number;
  asset_type: string;
  marketState: string | null;
}

let cachedRaw: { data: RawForex[]; timestamp: number } | null = null;
const CACHE_TTL = 10000;

export async function GET() {
  try {
    let rawData: RawForex[];

    if (cachedRaw && Date.now() - cachedRaw.timestamp < CACHE_TTL) {
      rawData = cachedRaw.data;
    } else {
      const yf = await getYahooFinance();

      const results = await Promise.allSettled(
        FOREX_SYMBOLS.map(async (item) => {
          try {
            const quote = await yf.quote(item.symbol);
            return {
              symbol: item.symbol,
              name: item.name,
              price: quote.regularMarketPrice ?? 0,
              change24h: quote.regularMarketChange ?? 0,
              changePercent24h: quote.regularMarketChangePercent ?? 0,
              volume: quote.regularMarketVolume ?? 0,
              marketCap: 0,
              high24h:
                quote.regularMarketDayHigh ?? quote.regularMarketPrice ?? 0,
              low24h:
                quote.regularMarketDayLow ?? quote.regularMarketPrice ?? 0,
              asset_type: "forex",
              marketState: quote.marketState ?? null,
            } as RawForex;
          } catch {
            return null;
          }
        })
      );

      rawData = results
        .filter((r) => r.status === "fulfilled" && r.value !== null)
        .map((r) => (r as PromiseFulfilledResult<RawForex>).value)
        .filter((item) => item.price > 0);

      if (rawData.length > 0) {
        cachedRaw = { data: rawData, timestamp: Date.now() };
      }
    }

    const overrides = await getActiveOverrides();
    const data = applyOverrides(rawData, overrides);

    const hasOverrides = Object.keys(overrides).length > 0;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": hasOverrides
          ? "no-store, no-cache, must-revalidate"
          : "public, max-age=8",
      },
    });
  } catch (error) {
    console.error("Forex API error:", error);
    if (cachedRaw) {
      const overrides = await getActiveOverrides();
      const data = applyOverrides(cachedRaw.data, overrides);
      return NextResponse.json(data);
    }
    return NextResponse.json([], { status: 500 });
  }
}
