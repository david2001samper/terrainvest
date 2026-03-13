import { NextResponse } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";

const SYMBOLS = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "META", name: "Meta Platforms" },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "JPM", name: "JPMorgan Chase" },
];

const COMMODITY_SYMBOLS = [
  { symbol: "GC=F", name: "Gold" },
  { symbol: "CL=F", name: "Crude Oil WTI" },
  { symbol: "SI=F", name: "Silver" },
  { symbol: "NG=F", name: "Natural Gas" },
  { symbol: "PL=F", name: "Platinum" },
];

const INDEX_SYMBOLS = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "NASDAQ Composite" },
  { symbol: "^DJI", name: "Dow Jones Industrial" },
  { symbol: "^RUT", name: "Russell 2000" },
];

let cachedData: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 10000;

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedData.data);
    }

    const allSymbols = [
      ...SYMBOLS.map((s) => ({ ...s, type: "stock" as const })),
      ...COMMODITY_SYMBOLS.map((s) => ({ ...s, type: "commodity" as const })),
      ...INDEX_SYMBOLS.map((s) => ({ ...s, type: "index" as const })),
    ];

    const yf = await getYahooFinance();

    const results = await Promise.allSettled(
      allSymbols.map(async (item) => {
        try {
          const quote = await yf.quote(item.symbol);
          return {
            symbol: item.symbol,
            name: item.name,
            price: quote.regularMarketPrice ?? 0,
            change24h: quote.regularMarketChange ?? 0,
            changePercent24h: quote.regularMarketChangePercent ?? 0,
            volume: quote.regularMarketVolume ?? 0,
            marketCap: quote.marketCap ?? 0,
            high24h: quote.regularMarketDayHigh ?? quote.regularMarketPrice ?? 0,
            low24h: quote.regularMarketDayLow ?? quote.regularMarketPrice ?? 0,
            asset_type: item.type,
            marketState: quote.marketState ?? null,
          };
        } catch {
          return null;
        }
      })
    );

    let data = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<unknown>).value)
      .filter((item: unknown) => (item as { price: number }).price > 0);

    const overrides = await getActiveOverrides();
    data = applyOverrides(data as { symbol: string; price: number }[], overrides);

    if (data.length > 0) {
      cachedData = { data, timestamp: Date.now() };
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Stocks API error:", error);
    if (cachedData) {
      return NextResponse.json(cachedData.data);
    }
    return NextResponse.json([], { status: 500 });
  }
}
