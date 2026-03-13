import { NextResponse } from "next/server";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";

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

let cachedData: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 8000;

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedData.data);
    }

    const ids = Object.values(COINGECKO_IDS).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 8 },
      }
    );

    if (!res.ok) {
      throw new Error(`CoinGecko API error: ${res.status}`);
    }

    const coins = await res.json();
    const symbolMap = Object.entries(COINGECKO_IDS).reduce(
      (acc, [sym, id]) => ({ ...acc, [id]: sym }),
      {} as Record<string, string>
    );

    let data = coins.map((coin: Record<string, unknown>) => {
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

    cachedData = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error("Crypto API error:", error);
    if (cachedData) {
      return NextResponse.json(cachedData.data);
    }
    return NextResponse.json([], { status: 500 });
  }
}
