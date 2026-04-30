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

const cryptoPriceCache: Record<string, { price: number; ts: number }> = {};
const CRYPTO_CACHE_TTL = 8_000;
const CRYPTO_STALE_TTL = 60_000;

// Shared batch cache for Binance prices so all coins share one HTTP call.
let binanceBatchCache: { prices: Record<string, number>; ts: number } | null = null;
const BINANCE_BATCH_TTL = 8_000;

export function updateCryptoPriceCache(symbol: string, price: number) {
  cryptoPriceCache[symbol.toUpperCase()] = { price, ts: Date.now() };
}

/**
 * Fetch all known crypto prices from Binance in one batch request and cache
 * the result. Returns a map of symbol → USD price.
 */
async function fetchBinancePriceBatch(): Promise<Record<string, number>> {
  if (binanceBatchCache && Date.now() - binanceBatchCache.ts < BINANCE_BATCH_TTL) {
    return binanceBatchCache.prices;
  }

  const symbols = Object.values(BINANCE_SYMBOL_MAP);
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return binanceBatchCache?.prices ?? {};

    const data = (await res.json()) as { symbol: string; price: string }[];
    const reverseMap = Object.fromEntries(
      Object.entries(BINANCE_SYMBOL_MAP).map(([sym, bin]) => [bin, sym])
    );

    const prices: Record<string, number> = {};
    for (const item of data) {
      const sym = reverseMap[item.symbol];
      if (sym) {
        const p = parseFloat(item.price);
        if (!isNaN(p) && p > 0) {
          prices[sym] = p;
          // Keep the per-symbol cache warm too.
          cryptoPriceCache[sym] = { price: p, ts: Date.now() };
        }
      }
    }

    binanceBatchCache = { prices, ts: Date.now() };
    return prices;
  } catch {
    return binanceBatchCache?.prices ?? {};
  }
}

function resolveAssetType(symbol: string, assetTypeHint?: string) {
  if (
    assetTypeHint &&
    ["crypto", "stock", "commodity", "index", "forex"].includes(assetTypeHint)
  ) {
    return assetTypeHint;
  }
  const s = symbol.toUpperCase();
  if (COINGECKO_IDS[s]) return "crypto";
  if (s.endsWith("=X")) return "forex";
  if (s.startsWith("^")) return "index";
  if (s.endsWith("=F")) return "commodity";
  return "stock";
}

/**
 * Fetch the live underlying price from Binance (primary) / CoinGecko (fallback)
 * / Yahoo, bypassing any active admin override.
 */
export async function fetchRealMarketPrice(
  symbol: string,
  assetTypeHint?: string
): Promise<number | null> {
  const sym = symbol.toUpperCase();
  const _assetType = resolveAssetType(sym, assetTypeHint);
  void _assetType;

  if (COINGECKO_IDS[sym]) {
    // Check per-symbol cache first.
    const cached = cryptoPriceCache[sym];
    if (cached && Date.now() - cached.ts < CRYPTO_CACHE_TTL) {
      return cached.price;
    }

    const stalePrice =
      cached && Date.now() - cached.ts < CRYPTO_STALE_TTL ? cached.price : null;

    // --- Primary: Binance batch (one request covers all coins) ---
    try {
      const prices = await fetchBinancePriceBatch();
      if (prices[sym] != null) {
        return prices[sym];
      }
    } catch {
      // fall through to CoinGecko
    }

    // --- Fallback: CoinGecko individual call ---
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS[sym]}&vs_currencies=usd`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        return stalePrice;
      }
      const data = await res.json();
      const price: number | undefined = data[COINGECKO_IDS[sym]]?.usd;
      if (price != null) {
        cryptoPriceCache[sym] = { price, ts: Date.now() };
        return price;
      }
      return stalePrice;
    } catch {
      return stalePrice;
    }
  }

  try {
    const { getYahooFinance } = await import("@/lib/yahoo");
    const yf = await getYahooFinance();
    const quote = await yf.quote(symbol);
    return quote.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

export async function fetchMarketPrice(
  symbol: string,
  assetTypeHint?: string
): Promise<number | null> {
  const sym = symbol.toUpperCase();

  // When an admin price override (price simulation) is active, the override
  // value already IS the simulated price for this tick — the simulation route
  // writes a fresh value every second along its ramp/hold/recovery curve.
  // We deliberately do NOT layer additional Gaussian noise on top of it here:
  // doing so was previously producing 1–2% phantom drift that made limit
  // orders fail against their own target, made HOLD phase visibly wander,
  // and caused trade executions to print prices noticeably different from
  // what the user just saw on screen.
  try {
    const { getActiveOverrides } = await import("@/lib/price-overrides");
    const overrides = await getActiveOverrides();
    if (overrides[sym] != null) {
      void resolveAssetType(sym, assetTypeHint); // kept for future asset routing
      return overrides[sym];
    }
  } catch {
    // override lookup failed — continue to real price
  }

  return fetchRealMarketPrice(symbol, assetTypeHint);
}
