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

const BINANCE_PAIRS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
  DOT: "DOTUSDT",
  AVAX: "AVAXUSDT",
  MATIC: "MATICUSDT",
  LINK: "LINKUSDT",
};

// CoinGecko base data (24h stats, market cap, etc.) — refreshes every 60s
let cgCache: { data: CoinGeckoMarketRow[]; ts: number } | null = null;
const CG_TTL = 60_000;

// Binance live prices — refreshes every 4s
let binanceCache: { prices: Record<string, number>; ts: number } | null = null;
const BINANCE_TTL = 4_000;

async function fetchCoinGeckoBase(): Promise<CoinGeckoMarketRow[]> {
  if (cgCache && Date.now() - cgCache.ts < CG_TTL) return cgCache.data;

  const ids = Object.values(COINGECKO_IDS).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
    { headers: { Accept: "application/json" }, cache: "no-store" }
  );

  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  const data = (await res.json()) as CoinGeckoMarketRow[];
  cgCache = { data, ts: Date.now() };
  return data;
}

async function fetchBinancePrices(): Promise<Record<string, number>> {
  if (binanceCache && Date.now() - binanceCache.ts < BINANCE_TTL) {
    return binanceCache.prices;
  }

  try {
    const symbols = JSON.stringify(Object.values(BINANCE_PAIRS));
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return binanceCache?.prices ?? {};

    const tickers = (await res.json()) as { symbol: string; price: string }[];
    const pairToSym = Object.entries(BINANCE_PAIRS).reduce(
      (acc, [sym, pair]) => ({ ...acc, [pair]: sym }),
      {} as Record<string, string>
    );

    const prices: Record<string, number> = {};
    for (const t of tickers) {
      const sym = pairToSym[t.symbol];
      if (sym) prices[sym] = parseFloat(t.price);
    }
    binanceCache = { prices, ts: Date.now() };
    return prices;
  } catch {
    return binanceCache?.prices ?? {};
  }
}

export async function GET() {
  try {
    const [rawData, livePrices] = await Promise.all([
      fetchCoinGeckoBase(),
      fetchBinancePrices(),
    ]);

    const symbolMap = Object.entries(COINGECKO_IDS).reduce(
      (acc, [sym, id]) => ({ ...acc, [id]: sym }),
      {} as Record<string, string>
    );

    let data = rawData.map((coin) => {
      const symbol =
        symbolMap[coin.id as string] ||
        (coin.symbol as string).toUpperCase();
      const livePrice = livePrices[symbol];
      const price = livePrice ?? coin.current_price;

      return {
        symbol,
        name: COINGECKO_NAMES[symbol] || coin.name,
        price,
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
          : "public, max-age=4",
      },
    });
  } catch (error) {
    console.error("Crypto API error:", error);
    if (cgCache) {
      const symbolMap = Object.entries(COINGECKO_IDS).reduce(
        (acc, [sym, id]) => ({ ...acc, [id]: sym }),
        {} as Record<string, string>
      );
      let data = cgCache.data.map((coin) => {
        const symbol =
          symbolMap[coin.id as string] ||
          (coin.symbol as string).toUpperCase();
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
