import { NextResponse } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";

const SNAPSHOT_CRYPTO = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
];

const SNAPSHOT_STOCKS = [
  { symbol: "AAPL", name: "Apple", type: "stock" as const },
  { symbol: "TSLA", name: "Tesla", type: "stock" as const },
  { symbol: "GC=F", name: "Gold", type: "commodity" as const },
  { symbol: "CL=F", name: "Crude Oil", type: "commodity" as const },
  { symbol: "^GSPC", name: "S&P 500", type: "index" as const },
  { symbol: "^IXIC", name: "NASDAQ", type: "index" as const },
];

export async function GET() {
  try {
    const [cryptoData, stocksData] = await Promise.all([
      fetchCrypto(),
      fetchStocks(),
    ]);

    const all = [...cryptoData, ...stocksData];
    let overrides: Record<string, number> = {};
    try {
      overrides = await getActiveOverrides();
    } catch {
      /* ignore */
    }
    const withOverrides = applyOverrides(all as { symbol: string; price: number }[], overrides);

    return NextResponse.json(withOverrides);
  } catch (error) {
    console.error("Market snapshot error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

async function fetchCrypto() {
  try {
    const ids = SNAPSHOT_CRYPTO.map((c) => c.id).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
      { headers: { Accept: "application/json" }, next: { revalidate: 8 } }
    );
    if (!res.ok) return [];
    const coins = await res.json();
    return coins.map((coin: Record<string, unknown>) => {
      const sym = SNAPSHOT_CRYPTO.find((c) => c.id === coin.id)?.symbol ?? (coin.symbol as string).toUpperCase();
      return {
        symbol: sym,
        name: coin.name,
        price: coin.current_price ?? 0,
        changePercent24h: coin.price_change_percentage_24h ?? 0,
        asset_type: "crypto",
      };
    });
  } catch {
    return [];
  }
}

async function fetchStocks() {
  try {
    const yf = await getYahooFinance();
    const results = await Promise.allSettled(
      SNAPSHOT_STOCKS.map(async (item) => {
        const quote = await yf.quote(item.symbol);
        return {
          symbol: item.symbol,
          name: item.name,
          price: quote.regularMarketPrice ?? 0,
          changePercent24h: quote.regularMarketChangePercent ?? 0,
          asset_type: item.type,
        };
      })
    );
    return results
      .filter((r) => r.status === "fulfilled" && (r as PromiseFulfilledResult<{ price: number }>).value.price > 0)
      .map((r) => (r as PromiseFulfilledResult<unknown>).value);
  } catch {
    return [];
  }
}
