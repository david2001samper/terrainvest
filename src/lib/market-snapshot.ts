import { unstable_cache } from "next/cache";
import { getYahooFinance } from "@/lib/yahoo";
import { symbolTradingViewLogoUrl } from "@/lib/tradingview-symbol-logos";

export interface SnapshotAsset {
  symbol: string;
  name: string;
  price: number;
  changePercent24h: number;
  asset_type: string;
  /** Populated for home snapshot tiles when available */
  logoUrl?: string | null;
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
] as const;

/** Main homepage: two majors + eight Yahoo instruments (two rows × five columns). */
const HOME_CRYPTO_SYMBOLS = new Set<string>(["BTC", "ETH"]);

const HOME_SNAPSHOT_ORDER: string[] = [
  "BTC",
  "ETH",
  ...STOCK_ITEMS.map((s) => s.symbol),
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

function binanceMapEntries(symbolsFilter?: Set<string>): [string, string][] {
  const entries = Object.entries(BINANCE_SNAPSHOT_MAP);
  if (!symbolsFilter) return entries;
  return entries.filter(([sym]) => symbolsFilter.has(sym));
}

async function fetchCryptoSnapshotFromBinance(
  symbolsFilter?: Set<string>
): Promise<SnapshotAsset[]> {
  const pairs = binanceMapEntries(symbolsFilter);
  if (pairs.length === 0) return [];

  const symbols = pairs.map(([, bin]) => bin);
  const reverseMap = Object.fromEntries(pairs.map(([sym, bin]) => [bin, sym]));

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

async function fetchCryptoSnapshot(symbolsFilter?: Set<string>): Promise<SnapshotAsset[]> {
  const cryptos = symbolsFilter
    ? CRYPTO_IDS.filter((c) => symbolsFilter.has(c.symbol))
    : CRYPTO_IDS;
  if (cryptos.length === 0) return [];

  const ids = cryptos.map((c) => c.id).join(",");

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
          symbol: match?.symbol ?? String(coin.symbol ?? "").toUpperCase(),
          name: match?.name ?? String(coin.name ?? ""),
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

  return fetchCryptoSnapshotFromBinance(symbolsFilter);
}

async function fetchStocksSnapshot(
  items: readonly (typeof STOCK_ITEMS)[number][] = STOCK_ITEMS
): Promise<SnapshotAsset[]> {
  const yf = await getYahooFinance();
  const results = await Promise.allSettled(
    items.map(async (item) => {
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

function attachHomeLogos(assets: SnapshotAsset[]): SnapshotAsset[] {
  return assets.map((a) => ({
    ...a,
    logoUrl: symbolTradingViewLogoUrl(a.symbol),
  }));
}

async function fetchHomeSnapshotUncached(): Promise<SnapshotAsset[]> {
  const [crypto, stocks] = await Promise.allSettled([
    fetchCryptoSnapshot(HOME_CRYPTO_SYMBOLS),
    fetchStocksSnapshot(STOCK_ITEMS),
  ]);
  const cryptoData = crypto.status === "fulfilled" ? crypto.value : [];
  const stocksData = stocks.status === "fulfilled" ? stocks.value : [];
  const map = new Map<string, SnapshotAsset>();
  for (const a of [...cryptoData, ...stocksData]) {
    map.set(a.symbol, a);
  }

  const ordered: SnapshotAsset[] = [];
  for (const sym of HOME_SNAPSHOT_ORDER) {
    const row = map.get(sym);
    if (row) ordered.push(row);
  }

  return attachHomeLogos(ordered.slice(0, 10));
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

/** Curated 10 tiles for the homepage (two rows × five columns), each with a logo URL when listed. */
export async function getHomeMarketSnapshot(): Promise<SnapshotAsset[]> {
  try {
    return await unstable_cache(
      () => fetchHomeSnapshotUncached(),
      ["home-market-snapshot"],
      { revalidate: 30 }
    )();
  } catch {
    return [];
  }
}
