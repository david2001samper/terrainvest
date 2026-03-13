"use client";

import { useWatchlist } from "@/hooks/use-watchlist";
import { useMarketData } from "@/hooks/use-market-data";
import { formatPercent } from "@/lib/format";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceChart } from "@/components/price-chart";
import { AssetLogo } from "@/components/asset-logo";
import { PriceFlash } from "@/components/price-flash";
import { LastUpdated } from "@/components/last-updated";
import {
  Heart,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WatchlistPage() {
  const { format: formatCurrency } = useCurrencyFormat();
  const { data: watchlistItems, isLoading: wlLoading, toggle } = useWatchlist();
  const { allAssets, isLoading: mktLoading } = useMarketData();

  const isLoading = wlLoading || mktLoading;

  const watchedAssets = watchlistItems
    ?.map((w) => {
      const asset = allAssets.find((a) => a.symbol === w.symbol);
      return asset ? { ...asset, watchlistId: w.id } : null;
    })
    .filter(Boolean) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="w-6 h-6 text-[#00D4FF]" />
          Watchlist
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your favorite assets at a glance
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : watchedAssets.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="font-medium text-lg mb-2">No assets in watchlist</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add assets from the Markets page to track them here
            </p>
            <Link href="/markets">
              <Button className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] hover:from-[#22D3EE] hover:to-[#00D4FF] text-[#0A0B0F] font-semibold">
                <TrendingUp className="w-4 h-4 mr-2" />
                Browse Markets
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {watchedAssets.map((asset) => {
            if (!asset) return null;
            const isUp = asset.changePercent24h >= 0;
            return (
              <Card key={asset.symbol} className="glass-card-hover group">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <Link
                    href={`/markets/${encodeURIComponent(asset.symbol)}?type=${asset.asset_type}`}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <AssetLogo symbol={asset.symbol} assetType={asset.asset_type} size={40} />
                    <div>
                      <CardTitle className="text-lg font-bold group-hover:text-[#00D4FF] transition-colors">
                        {asset.symbol}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{asset.name}</p>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggle.mutate(asset.symbol)}
                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between mb-3">
                    <PriceFlash value={asset.price}>
                      <p className="text-2xl font-bold">
                        {formatCurrency(asset.price, asset.price < 1 ? 6 : 2)}
                      </p>
                    </PriceFlash>
                    <div
                      className={`flex items-center gap-1 font-medium ${
                        isUp ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isUp ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      {formatPercent(asset.changePercent24h)}
                    </div>
                  </div>
                  <PriceChart
                    symbol={asset.symbol}
                    assetType={asset.asset_type}
                    height={100}
                    minimal
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
