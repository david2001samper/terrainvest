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
 * Fetch the live underlying price from CoinGecko / Yahoo, **bypassing** any
 * active admin override. This is what the simulation route calls every tick
 * so the simulated price tracks the real market continuously instead of being
 * anchored on a stale snapshot taken when the simulation was started.
 */
export async function fetchRealMarketPrice(
  symbol: string,
  assetTypeHint?: string
): Promise<number | null> {
  const sym = symbol.toUpperCase();
  const _assetType = resolveAssetType(sym, assetTypeHint); // reserved for future per-asset routing
  void _assetType;

  if (COINGECKO_IDS[sym]) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS[sym]}&vs_currencies=usd`,
        { cache: "no-store" }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data[COINGECKO_IDS[sym]]?.usd ?? null;
    } catch {
      return null;
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
