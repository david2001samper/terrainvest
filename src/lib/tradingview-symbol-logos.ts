/**
 * Public SVG logos from TradingView’s CDN — same host used across the marketing snapshot
 * and the in-app AssetLogo component for stocks, crypto, commodities, and indices.
 */
const TV = "https://s3-symbol-logo.tradingview.com";

/** Path after TV base (no leading slash). Keys are Yahoo / internal symbols as stored in DB. */
const SYMBOL_TO_TV_PATH: Record<string, string> = {
  BTC: "crypto/XTVCBTC.svg",
  ETH: "crypto/XTVCETH.svg",
  SOL: "crypto/XTVCSOL.svg",
  XRP: "crypto/XTVCXRP.svg",
  ADA: "crypto/XTVCADA.svg",
  DOGE: "crypto/XTVCDOGE.svg",
  DOT: "crypto/XTVCDOT.svg",
  AVAX: "crypto/XTVCAVAX.svg",
  MATIC: "crypto/XTVCMATIC.svg",
  LINK: "crypto/XTVCLINK.svg",
  BNB: "crypto/XTVCBNB.svg",

  AAPL: "apple.svg",
  TSLA: "tesla.svg",
  NVDA: "nvidia.svg",
  AMZN: "amazon.svg",
  GOOGL: "alphabet.svg",
  MSFT: "microsoft.svg",
  META: "meta-platforms.svg",
  NFLX: "netflix.svg",
  AMD: "advanced-micro-devices.svg",
  JPM: "jpmorgan.svg",

  "GC=F": "metal/gold.svg",
  "CL=F": "crude-oil.svg",
  "SI=F": "metal/silver.svg",
  "NG=F": "natural-gas.svg",
  "PL=F": "metal/platinum.svg",

  "^GSPC": "indices/s-and-p-500.svg",
  "^IXIC": "indices/nasdaq-100.svg",
  "^DJI": "dow.svg",
  "^RUT": "indices/russell-2000-index.svg",
};

export function symbolTradingViewLogoUrl(symbol: string): string | null {
  const s = symbol.trim();
  const path = SYMBOL_TO_TV_PATH[s] ?? SYMBOL_TO_TV_PATH[s.toUpperCase()];
  if (!path) return null;
  return `${TV}/${path}`;
}
