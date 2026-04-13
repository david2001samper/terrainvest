"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import type { MarketAsset } from "@/lib/types";

interface MarketHeatmapProps {
  assets: MarketAsset[];
}

function getHeatColor(pct: number): string {
  const clamped = Math.max(-5, Math.min(5, pct));
  if (clamped >= 0) {
    const intensity = Math.min(clamped / 5, 1);
    const r = Math.round(20 + (34 - 20) * intensity);
    const g = Math.round(30 + (197 - 30) * intensity);
    const b = Math.round(30 + (94 - 30) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const intensity = Math.min(Math.abs(clamped) / 5, 1);
    const r = Math.round(30 + (229 - 30) * intensity);
    const g = Math.round(25 + (62 - 25) * intensity);
    const b = Math.round(25 + (62 - 25) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export function MarketHeatmap({ assets }: MarketHeatmapProps) {
  const { format: formatCurrency } = useCurrencyFormat();

  const sortedAssets = useMemo(() => {
    return [...assets].sort(
      (a, b) => (b.marketCap || 0) - (a.marketCap || 0)
    );
  }, [assets]);

  if (sortedAssets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No assets to display
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1.5">
      {sortedAssets.map((asset) => {
        const pct = asset.changePercent24h ?? 0;
        const bgColor = getHeatColor(pct);
        const isUp = pct >= 0;

        return (
          <Link
            key={asset.symbol}
            href={`/markets/${encodeURIComponent(asset.symbol)}?type=${asset.asset_type}${
              asset.coingecko_id
                ? `&cg=${encodeURIComponent(asset.coingecko_id)}`
                : ""
            }`}
            className="group relative rounded-lg p-3 transition-all hover:scale-105 hover:z-10 hover:shadow-lg border border-transparent hover:border-white/25"
            style={{ backgroundColor: bgColor }}
          >
            <p className="text-xs font-bold text-white truncate">
              {asset.symbol.replace("=X", "").replace("^", "")}
            </p>
            <p className="text-[11px] font-medium text-white mt-0.5">
              {formatCurrency(asset.price, asset.price < 1 ? 4 : 2)}
            </p>
            <p className="text-[10px] font-bold mt-0.5 text-white drop-shadow">
              {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
            </p>
          </Link>
        );
      })}
    </div>
  );
}
