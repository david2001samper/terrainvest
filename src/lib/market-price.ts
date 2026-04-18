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

export async function fetchMarketPrice(
  symbol: string,
  assetTypeHint?: string
): Promise<number | null> {
  const sym = symbol.toUpperCase();

  try {
    const { getActiveOverrides } = await import("@/lib/price-overrides");
    const { simulatePrice } = await import("@/lib/price-simulator");
    const overrides = await getActiveOverrides();
    if (overrides[sym] != null) {
      const assetType = resolveAssetType(sym, assetTypeHint);
      return simulatePrice(sym, overrides[sym], assetType);
    }
  } catch {
    // override lookup failed — continue to real price
  }

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
