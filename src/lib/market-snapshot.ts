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

async function fetchCryptoSnapshot(): Promise<SnapshotAsset[]> {
  const ids = CRYPTO_IDS.map((c) => c.id).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`,
    {
      headers: { Accept: "application/json", "User-Agent": "TerraInvestVIP/1.0" },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const coins = await res.json();
  return coins.map((coin: Record<string, unknown>) => {
    const match = CRYPTO_IDS.find((c) => c.id === coin.id);
    return {
      symbol: match?.symbol ?? (coin.symbol as string).toUpperCase(),
      name: match?.name ?? coin.name,
      price: (coin.current_price as number) ?? 0,
      changePercent24h: (coin.price_change_percentage_24h as number) ?? 0,
      asset_type: "crypto",
    };
  });
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
