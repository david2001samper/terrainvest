import { NextResponse } from "next/server";
import { getActiveOverrides, applyOverrides } from "@/lib/price-overrides";
import { updateCryptoPriceCache } from "@/lib/market-price";

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

type Binance24hrRow = {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
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

const BINANCE_SYMBOL_MAP: Record<string, string> = {
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

let cachedRaw: { data: CoinGeckoMarketRow[]; timestamp: number } | null = null;
const CACHE_TTL = 4000;

function rowsFromCoinGecko(rawData: CoinGeckoMarketRow[]) {
  const symbolMap = Object.entries(COINGECKO_IDS).reduce(
    (acc, [sym, id]) => ({ ...acc, [id]: sym }),
    {} as Record<string, string>
  );

  return rawData.map((coin) => {
    const symbol =
      symbolMap[coin.id as string] || (coin.symbol as string).toUpperCase();
    if (coin.current_price != null) {
      updateCryptoPriceCache(symbol, coin.current_price);
    }
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
}

async function fetchFromBinance() {
  const binanceSymbols = Object.values(BINANCE_SYMBOL_MAP);
  const reverseMap = Object.fromEntries(
    Object.entries(BINANCE_SYMBOL_MAP).map(([sym, bin]) => [bin, sym])
  );

  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
    JSON.stringify(binanceSymbols)
  )}`;

  const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);

  const rows = (await res.json()) as Binance24hrRow[];

  return rows
    .map((row) => {
      const symbol = reverseMap[row.symbol];
      if (!symbol) return null;

      const price = parseFloat(row.lastPrice);
      const change24h = parseFloat(row.priceChange);
      const changePercent24h = parseFloat(row.priceChangePercent);
      const high24h = parseFloat(row.highPrice);
      const low24h = parseFloat(row.lowPrice);
      // quoteVolume is in USDT — equivalent to USD volume
      const volume = parseFloat(row.quoteVolume);

      if (!isNaN(price) && price > 0) {
        updateCryptoPriceCache(symbol, price);
      }

      return {
        symbol,
        name: COINGECKO_NAMES[symbol] || symbol,
        price,
        change24h,
        changePercent24h,
        volume,
        marketCap: 0, // Binance doesn't provide market cap
        high24h,
        low24h,
        asset_type: "crypto",
      };
    })
    .filter(Boolean);
}

export async function GET() {
  try {
    // --- Primary: CoinGecko (has market cap data) ---
    let data: ReturnType<typeof rowsFromCoinGecko> | null = null;

    if (cachedRaw && Date.now() - cachedRaw.timestamp < CACHE_TTL) {
      data = rowsFromCoinGecko(cachedRaw.data);
    } else {
      try {
        const ids = Object.values(COINGECKO_IDS).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          }
        );

        if (res.ok) {
          const rawData = (await res.json()) as CoinGeckoMarketRow[];
          cachedRaw = { data: rawData, timestamp: Date.now() };
          data = rowsFromCoinGecko(rawData);
        }
      } catch {
        // CoinGecko failed — fall through to Binance
      }
    }

    // --- Fallback: Binance 24hr ticker ---
    if (!data || data.length === 0) {
      // Try stale CoinGecko cache first
      if (cachedRaw) {
        data = rowsFromCoinGecko(cachedRaw.data);
      } else {
        // Last resort: Binance (no market cap but has everything else)
        const binanceRows = await fetchFromBinance();
        data = binanceRows as typeof data;
      }
    } else {
      // Even when CoinGecko succeeded, patch any coin with price=0/null from Binance
      const missingPrices = data.some((c) => !c.price);
      if (missingPrices) {
        try {
          const binanceRows = await fetchFromBinance();
          const binanceMap = Object.fromEntries(
            (binanceRows as { symbol: string; price: number }[]).map((r) => [r.symbol, r.price])
          );
          data = data.map((c) =>
            !c.price && binanceMap[c.symbol]
              ? { ...c, price: binanceMap[c.symbol] }
              : c
          );
        } catch {
          // best-effort patch
        }
      }
    }

    const overrides = await getActiveOverrides();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalData = applyOverrides(data as any[], overrides);

    const hasOverrides = Object.keys(overrides).length > 0;
    return NextResponse.json(finalData, {
      headers: {
        "Cache-Control": hasOverrides
          ? "no-store, no-cache, must-revalidate"
          : "public, max-age=6",
      },
    });
  } catch (error) {
    console.error("Crypto API error:", error);

    // Last-ditch: Binance only
    try {
      const binanceRows = await fetchFromBinance();
      const overrides = await getActiveOverrides();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalData = applyOverrides(binanceRows as any[], overrides);
      return NextResponse.json(finalData);
    } catch {
      return NextResponse.json([], { status: 500 });
    }
  }
}
