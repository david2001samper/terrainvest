import { NextResponse } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";
import { parseForexSymbol, inferPipSize, DEFAULT_CONTRACT_SIZE } from "@/lib/forex/instruments";
import { midToBidAsk } from "@/lib/forex/pricing";

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
  bid?: number;
  ask?: number;
  spreadPips?: number;
  pipSize?: number;
  base?: string;
  quote?: string;
  contractSize?: number;
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
// Must be shorter than the client poll interval (12 s in use-market-data.ts)
// or every other request returns the same cached data and prices appear to
// update half as often as expected.
const CACHE_TTL = 6000;

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
    const data = applyOverrides(rawData, overrides).map((r) => {
      const parsed = parseForexSymbol(r.symbol);
      const base = parsed?.base ?? "";
      const quote = parsed?.quote ?? "";
      const pipSize = inferPipSize(r.symbol);
      const bidAsk = midToBidAsk({
        instrument: { pipSize, typicalSpreadPips: quote === "JPY" ? 1.4 : 1.1 },
        mid: r.price,
        changePercent24h: r.changePercent24h,
      });
      return {
        ...r,
        base,
        quote,
        pipSize,
        contractSize: DEFAULT_CONTRACT_SIZE,
        bid: bidAsk.bid,
        ask: bidAsk.ask,
        spreadPips: bidAsk.spreadPips,
      };
    });

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
