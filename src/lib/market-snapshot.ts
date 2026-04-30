import { unstable_cache } from "next/cache";
import { getYahooFinance } from "@/lib/yahoo";

export interface SnapshotAsset {
  symbol: string;
  name: string;
  price: number;
  changePercent24h: number;
  asset_type: string;
}

const CRYPTO_IDS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
  { id: "matic-network", symbol: "MATIC", name: "Polygon" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
];

const STOCK_ITEMS = [
  { symbol: "AAPL", name: "Apple", type: "stock" },
  { symbol: "TSLA", name: "Tesla", type: "stock" },
  { symbol: "NVDA", name: "NVIDIA", type: "stock" },
  { symbol: "AMZN", name: "Amazon", type: "stock" },
  { symbol: "GC=F", name: "Gold", type: "commodity" },
  { symbol: "CL=F", name: "Crude Oil", type: "commodity" },
  { symbol: "^GSPC", name: "S&P 500", type: "index" },
  { symbol: "^IXIC", name: "NASDAQ", type: "index" },
];

const BINANCE_SNAPSHOT_MAP: Record<string, string> = {
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

async function fetchCryptoSnapshotFromBinance(): Promise<SnapshotAsset[]> {
  const symbols = Object.values(BINANCE_SNAPSHOT_MAP);
  const reverseMap = Object.fromEntries(
    Object.entries(BINANCE_SNAPSHOT_MAP).map(([sym, bin]) => [bin, sym])
  );

  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(
    JSON.stringify(symbols)
  )}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];

  const rows = (await res.json()) as {
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
  }[];

  return rows
    .map((row) => {
      const sym = reverseMap[row.symbol];
      if (!sym) return null;
      const match = CRYPTO_IDS.find((c) => c.symbol === sym);
      return {
        symbol: sym,
        name: match?.name ?? sym,
        price: parseFloat(row.lastPrice) || 0,
        changePercent24h: parseFloat(row.priceChangePercent) || 0,
        asset_type: "crypto",
      };
    })
    .filter((x): x is SnapshotAsset => x !== null && x.price > 0);
}

async function fetchCryptoSnapshot(): Promise<SnapshotAsset[]> {
  const ids = CRYPTO_IDS.map((c) => c.id).join(",");

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
      {
        headers: { Accept: "application/json", "User-Agent": "TerraInvestVIP/1.0" },
        cache: "no-store",
      }
    );

    if (res.ok) {
      const coins = await res.json();
      const result: SnapshotAsset[] = coins.map((coin: Record<string, unknown>) => {
        const match = CRYPTO_IDS.find((c) => c.id === coin.id);
        return {
          symbol: match?.symbol ?? (coin.symbol as string).toUpperCase(),
          name: match?.name ?? coin.name,
          price: (coin.current_price as number) ?? 0,
          changePercent24h: (coin.price_change_percentage_24h as number) ?? 0,
          asset_type: "crypto",
        };
      });
      if (result.length > 0) return result;
    }
  } catch {
    // fall through to Binance
  }

  // Binance fallback: generous rate limits, always available
  return fetchCryptoSnapshotFromBinance();
}

async function fetchStocksSnapshot(): Promise<SnapshotAsset[]> {
  const yf = await getYahooFinance();
  const results = await Promise.allSettled(
    STOCK_ITEMS.map(async (item) => {
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
    .filter(
      (r) =>
        r.status === "fulfilled" &&
        (r as PromiseFulfilledResult<SnapshotAsset>).value.price > 0
    )
    .map((r) => (r as PromiseFulfilledResult<SnapshotAsset>).value);
}

async function fetchSnapshotUncached(): Promise<SnapshotAsset[]> {
  const [crypto, stocks] = await Promise.allSettled([
    fetchCryptoSnapshot(),
    fetchStocksSnapshot(),
  ]);
  const cryptoData = crypto.status === "fulfilled" ? crypto.value : [];
  const stocksData = stocks.status === "fulfilled" ? stocks.value : [];
  return [...cryptoData, ...stocksData];
}

export async function getMarketSnapshot(): Promise<SnapshotAsset[]> {
  try {
    return await unstable_cache(
      () => fetchSnapshotUncached(),
      ["market-snapshot"],
      { revalidate: 30 }
    )();
  } catch {
    return [];
  }
}
