"use client";

import { useMarketData } from "@/hooks/use-market-data";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { formatPercent } from "@/lib/format";
import { AssetLogo } from "@/components/asset-logo";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const SNAPSHOT_SYMBOLS = [
  "BTC",
  "ETH",
  "AAPL",
  "TSLA",
  "GC=F",
  "CL=F",
  "^GSPC",
  "^IXIC",
];

const DISPLAY_NAMES: Record<string, string> = {
  BTC: "BTC/USD",
  ETH: "ETH/USD",
  "GC=F": "Gold XAU/USD",
  "CL=F": "Crude Oil CL=F",
  "^GSPC": "S&P 500 ^GSPC",
  "^IXIC": "NASDAQ ^IXIC",
};

export function LiveMarketSnapshot() {
  const { format: formatCurrency } = useCurrencyFormat();
  const { allAssets, isLoading } = useMarketData();

  const snapshotAssets = SNAPSHOT_SYMBOLS.map((sym) =>
    allAssets.find((a) => a.symbol === sym)
  ).filter(Boolean);

  if (isLoading && snapshotAssets.length === 0) {
    return (
      <section className="relative z-10 px-6 lg:px-12 py-16 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">Live Market Snapshot</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="glass-card p-4 rounded-xl animate-pulse h-20 bg-muted/20"
            />
          ))}
        </div>
      </section>
    );
  }

  if (snapshotAssets.length === 0) return null;

  return (
    <section className="relative z-10 px-6 lg:px-12 py-16 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-center">Live Market Snapshot</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {snapshotAssets.map((asset) => {
          const isUp = (asset.changePercent24h ?? 0) >= 0;
          const displaySymbol = DISPLAY_NAMES[asset.symbol] ?? asset.symbol;
          return (
            <div
              key={asset.symbol}
              className="glass-card-hover p-4 rounded-xl flex items-center gap-3"
            >
              <AssetLogo
                symbol={asset.symbol}
                assetType={asset.asset_type}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {displaySymbol}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {formatCurrency(asset.price, asset.price < 1 ? 4 : 2)}
                </p>
                <span
                  className={`text-xs font-semibold flex items-center gap-0.5 ${
                    isUp ? "text-green-400" : "text-[#E53E3E]"
                  }`}
                >
                  {isUp ? (
                    <ArrowUpRight className="w-3 h-3 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 shrink-0" />
                  )}
                  {formatPercent(asset.changePercent24h)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
