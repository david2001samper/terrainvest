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

export async function fetchMarketPrice(symbol: string): Promise<number | null> {
  const sym = symbol.toUpperCase();

  try {
    const { getActiveOverrides } = await import("@/lib/price-overrides");
    const overrides = await getActiveOverrides();
    if (overrides[sym] != null) return overrides[sym];
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
