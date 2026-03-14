"use client";

import { useQuery } from "@tanstack/react-query";
import { useMarketData } from "@/hooks/use-market-data";
import { formatCurrency, formatPercent } from "@/lib/format";
import { AssetLogo } from "@/components/asset-logo";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const SNAPSHOT_SYMBOLS = ["BTC", "ETH", "AAPL", "TSLA", "GC=F", "CL=F", "^GSPC", "^IXIC"];

const DISPLAY_NAMES: Record<string, string> = {
  BTC: "BTC/USD",
  ETH: "ETH/USD",
  "GC=F": "Gold XAU/USD",
  "CL=F": "Crude Oil CL=F",
  "^GSPC": "S&P 500 ^GSPC",
  "^IXIC": "NASDAQ ^IXIC",
};

interface SnapshotAsset {
  symbol: string;
  name?: string;
  price: number;
  changePercent24h?: number;
  asset_type: string;
}

async function fetchSnapshotFallback(): Promise<SnapshotAsset[]> {
  const res = await fetch("/api/market/snapshot");
  if (!res.ok) return [];
  return res.json();
}

export function LiveMarketSnapshot() {
  const { data: snapshotData, isLoading: loadingSnapshot } = useQuery({
    queryKey: ["market", "snapshot"],
    queryFn: fetchSnapshotFallback,
    staleTime: 10000,
    refetchInterval: 15000,
    retry: 3,
    retryDelay: 2000,
  });

  const { allAssets, isLoading: loadingMarket } = useMarketData();

  const primaryAssets = SNAPSHOT_SYMBOLS.map((sym) =>
    allAssets.find((a) => a.symbol === sym)
  ).filter(Boolean) as SnapshotAsset[];

  const assets = (snapshotData?.length ?? 0) > 0 ? (snapshotData ?? []) : primaryAssets;
  const isLoading = (loadingSnapshot || loadingMarket) && assets.length === 0;

  if (isLoading && assets.length === 0) {
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

  if (assets.length === 0) {
    return (
      <section className="relative z-10 px-6 lg:px-12 py-16 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-8 text-center">Live Market Snapshot</h2>
        <p className="text-center text-muted-foreground">Market data temporarily unavailable</p>
      </section>
    );
  }

  return (
    <section className="relative z-10 px-6 lg:px-12 py-16 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-center">Live Market Snapshot</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {assets.map((asset) => {
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
