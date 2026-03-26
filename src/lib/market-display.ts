import type { AssetTypeValue } from "@/lib/types";

/** Remove Yahoo FX suffix (=X), futures suffix (=F), and index caret (^). */
export function stripYahooInstrumentSuffixes(symbol: string): string {
  return symbol.replace(/^[\^]+/, "").replace(/=F$/i, "").replace(/=X$/i, "");
}

type AssetLike = {
  symbol: string;
  name: string;
  asset_type: AssetTypeValue;
};

/** Primary label for cards/lists: friendly name for FX / futures / indexes. */
export function marketCardPrimaryLabel(asset: AssetLike): string {
  if (
    asset.asset_type === "forex" ||
    asset.asset_type === "commodity" ||
    asset.asset_type === "index"
  ) {
    return asset.name?.trim() || stripYahooInstrumentSuffixes(asset.symbol);
  }
  return asset.symbol;
}

/** Secondary line under the title on market-style cards. */
export function marketCardSecondaryLabel(asset: AssetLike): string {
  if (asset.asset_type === "forex") return "Forex";
  if (asset.asset_type === "commodity") return "Commodity";
  if (asset.asset_type === "index") return "Index";
  return asset.name || "";
}

/** Row label for positions: keep ticker for stocks/crypto; friendly or stripped for FX/commodity/index. */
export function positionRowLabel(
  symbol: string,
  assetType: string,
  marketName?: string | null
): string {
  if (
    assetType === "forex" ||
    assetType === "commodity" ||
    assetType === "index"
  ) {
    return (marketName && marketName.trim()) || stripYahooInstrumentSuffixes(symbol);
  }
  return symbol;
}
