"use client";

import { useMarketData } from "@/hooks/use-market-data";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { formatPercent } from "@/lib/format";
import { AssetLogo } from "@/components/asset-logo";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { marketCardPrimaryLabel } from "@/lib/market-display";

export function TickerTape() {
  const { format: formatCurrency } = useCurrencyFormat();
  const { allAssets } = useMarketData();
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [flashMap, setFlashMap] = useState<Record<string, "up" | "down" | null>>({});

  const topMovers = [...allAssets]
    .sort((a, b) => Math.abs(b.changePercent24h ?? 0) - Math.abs(a.changePercent24h ?? 0))
    .slice(0, 12);

  useEffect(() => {
    if (topMovers.length === 0) return;

    const newFlashes: Record<string, "up" | "down" | null> = {};
    const currentPrices: Record<string, number> = {};

    for (const asset of topMovers) {
      currentPrices[asset.symbol] = asset.price;
      const prev = prevPrices[asset.symbol];
      if (prev !== undefined && prev !== asset.price) {
        newFlashes[asset.symbol] = asset.price > prev ? "up" : "down";
      }
    }

    if (Object.keys(newFlashes).length > 0) {
      const frame = window.requestAnimationFrame(() => {
        setFlashMap((old) => ({ ...old, ...newFlashes }));
      });
      const timer = setTimeout(() => {
        setFlashMap((old) => {
          const cleared = { ...old };
          for (const k of Object.keys(newFlashes)) cleared[k] = null;
          return cleared;
        });
      }, 800);
      return () => {
        window.cancelAnimationFrame(frame);
        clearTimeout(timer);
      };
    }

    const frame = window.requestAnimationFrame(() => {
      setPrevPrices(currentPrices);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [topMovers.map((a) => `${a.symbol}:${a.price}`).join(",")]);

  if (topMovers.length === 0) return null;

  const items = [...topMovers, ...topMovers];

  return (
    <div className="w-full bg-[#0C0F16] border-b border-border overflow-hidden h-10 flex items-center relative z-50">
      <div
        className="flex items-center gap-0 ticker-animate whitespace-nowrap"
        style={{ "--ticker-speed": "45s" } as React.CSSProperties}
      >
        {items.map((asset, i) => {
          const isUp = (asset.changePercent24h ?? 0) >= 0;
          const flash = flashMap[asset.symbol];
          return (
            <div
              key={`${asset.symbol}-${i}`}
              className={`flex items-center gap-2 px-5 h-10 border-r border-border/50 transition-colors ${
                flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : ""
              }`}
            >
              <AssetLogo
                symbol={asset.symbol}
                assetType={asset.asset_type}
                coingeckoId={asset.coingecko_id}
                size={18}
              />
              <span className="text-xs font-semibold text-foreground">
                {marketCardPrimaryLabel(asset)}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {formatCurrency(asset.price, (asset.price ?? 0) < 1 ? 4 : 2)}
              </span>
              <span
                className={`text-[11px] font-semibold flex items-center gap-0.5 ${
                  isUp ? "text-green-400" : "text-[#E53E3E]"
                }`}
              >
                {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {formatPercent(asset.changePercent24h)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
