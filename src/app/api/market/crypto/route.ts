import { NextResponse } from "next/server";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";

type CoinGeckoMarketRow = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
  high_24h: number;
  low_24h: number;
};

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
};

const COINGECKO_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  DOT: "Polkadot",
  AVAX: "Avalanche",
  MATIC: "Polygon",
  LINK: "Chainlink",
};

let cachedRaw: { data: CoinGeckoMarketRow[]; timestamp: number } | null = null;
// Must be shorter than the client poll interval (8 s in use-market-data.ts)
// or every other request returns the same cached data and prices appear to
// update half as often as expected.
const CACHE_TTL = 4000;

export async function GET() {
  try {
    let rawData: CoinGeckoMarketRow[];

    if (cachedRaw && Date.now() - cachedRaw.timestamp < CACHE_TTL) {
      rawData = cachedRaw.data;
    } else {
      const ids = Object.values(COINGECKO_IDS).join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 8 },
        }
      );

      if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
      rawData = (await res.json()) as CoinGeckoMarketRow[];
      cachedRaw = { data: rawData, timestamp: Date.now() };
    }

    const symbolMap = Object.entries(COINGECKO_IDS).reduce(
      (acc, [sym, id]) => ({ ...acc, [id]: sym }),
      {} as Record<string, string>
    );

    let data = rawData.map((coin) => {
      const symbol = symbolMap[coin.id as string] || (coin.symbol as string).toUpperCase();
      return {
        symbol,
        name: COINGECKO_NAMES[symbol] || coin.name,
        price: coin.current_price,
        change24h: coin.price_change_24h,
        changePercent24h: coin.price_change_percentage_24h,
        volume: coin.total_volume,
        marketCap: coin.market_cap,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        asset_type: "crypto",
      };
    });

    const overrides = await getActiveOverrides();
    data = applyOverrides(data, overrides);

    const hasOverrides = Object.keys(overrides).length > 0;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": hasOverrides
          ? "no-store, no-cache, must-revalidate"
          : "public, max-age=6",
      },
    });
  } catch (error) {
    console.error("Crypto API error:", error);
    if (cachedRaw) {
      const symbolMap = Object.entries(COINGECKO_IDS).reduce(
        (acc, [sym, id]) => ({ ...acc, [id]: sym }),
        {} as Record<string, string>
      );
      let data = cachedRaw.data.map((coin) => {
        const symbol = symbolMap[coin.id as string] || (coin.symbol as string).toUpperCase();
        return {
          symbol,
          name: COINGECKO_NAMES[symbol] || coin.name,
          price: coin.current_price,
          change24h: coin.price_change_24h,
          changePercent24h: coin.price_change_percentage_24h,
          volume: coin.total_volume,
          marketCap: coin.market_cap,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          asset_type: "crypto",
        };
      });
      const overrides = await getActiveOverrides();
      data = applyOverrides(data, overrides);
      return NextResponse.json(data);
    }
    return NextResponse.json([], { status: 500 });
  }
}
