import { NextResponse, type NextRequest } from "next/server";
import { getYahooFinance } from "@/lib/yahoo";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 1) {
    return NextResponse.json([]);
  }

  try {
    const [cryptoResults, stockResults] = await Promise.allSettled([
      searchCrypto(query),
      searchStocks(query),
    ]);

    const crypto =
      cryptoResults.status === "fulfilled" ? cryptoResults.value : [];
    const stocks =
      stockResults.status === "fulfilled" ? stockResults.value : [];

    let combined = [...crypto, ...stocks].slice(0, 20);
    const overrides = await getActiveOverrides();
    combined = applyOverrides(combined, overrides);
    return NextResponse.json(combined);
  } catch {
    return NextResponse.json([]);
  }
}

async function searchCrypto(query: string) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();

    const coins = (data.coins || []).slice(0, 8);

    if (coins.length === 0) return [];

    const ids = coins.map((c: any) => c.id).join(",");
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false&price_change_percentage=24h`,
      { headers: { Accept: "application/json" } }
    );

    if (!priceRes.ok) {
      return coins.map((c: any) => ({
        symbol: (c.symbol || "").toUpperCase(),
        name: c.name,
        price: 0,
        change24h: 0,
        changePercent24h: 0,
        volume: 0,
        marketCap: c.market_cap_rank || 0,
        high24h: 0,
        low24h: 0,
        asset_type: "crypto",
        coingecko_id: c.id,
      }));
    }

    const prices = await priceRes.json();
    return prices.map((coin: any) => ({
      symbol: (coin.symbol || "").toUpperCase(),
      name: coin.name,
      price: coin.current_price ?? 0,
      change24h: coin.price_change_24h ?? 0,
      changePercent24h: coin.price_change_percentage_24h ?? 0,
      volume: coin.total_volume ?? 0,
      marketCap: coin.market_cap ?? 0,
      high24h: coin.high_24h ?? 0,
      low24h: coin.low_24h ?? 0,
      asset_type: "crypto",
      coingecko_id: coin.id,
    }));
  } catch {
    return [];
  }
}

async function searchStocks(query: string) {
  try {
    const yf = await getYahooFinance();
    const results = await yf.search(query, { quotesCount: 8, newsCount: 0 });

    if (!results.quotes || results.quotes.length === 0) return [];

    const symbols = results.quotes
      .filter((q: any) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.quoteType === "INDEX" || q.quoteType === "FUTURE" || q.quoteType === "COMMODITY"))
      .slice(0, 8);

    const quotes = await Promise.allSettled(
      symbols.map(async (s: any) => {
        const quote = await yf.quote(s.symbol);
        const type = s.quoteType === "INDEX" ? "index"
          : s.quoteType === "FUTURE" || s.quoteType === "COMMODITY" ? "commodity"
          : "stock";
        return {
          symbol: s.symbol,
          name: s.shortname || s.longname || s.symbol,
          price: quote.regularMarketPrice ?? 0,
          change24h: quote.regularMarketChange ?? 0,
          changePercent24h: quote.regularMarketChangePercent ?? 0,
          volume: quote.regularMarketVolume ?? 0,
          marketCap: quote.marketCap ?? 0,
          high24h: quote.regularMarketDayHigh ?? 0,
          low24h: quote.regularMarketDayLow ?? 0,
          asset_type: type,
        };
      })
    );

    return quotes
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value)
      .filter((item) => item.price > 0);
  } catch {
    return [];
  }
}
