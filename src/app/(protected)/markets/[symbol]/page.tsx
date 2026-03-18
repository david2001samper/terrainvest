"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMarketData, useChartData } from "@/hooks/use-market-data";
import { useWatchlist } from "@/hooks/use-watchlist";
import { PriceChart } from "@/components/price-chart";
import { TradePanel } from "@/components/trade-panel";
import { AssetLogo } from "@/components/asset-logo";
import { PriceFlash } from "@/components/price-flash";
import { LastUpdated } from "@/components/last-updated";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { TimeframeSelector, getTimeframeConfig, TIMEFRAMES, type TimeframeValue } from "@/components/timeframe-selector";
import { formatPercent } from "@/lib/format";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Heart,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

export default function AssetDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { format: formatCurrency, formatCompact } = useCurrencyFormat();
  const symbol = decodeURIComponent(params.symbol as string);
  const assetType = searchParams.get("type") || "stock";
  const [timeframe, setTimeframe] = useState<TimeframeValue>("1m");

  const { allAssets, isLoading, crypto, stocks } = useMarketData();
  const { isWatched, toggle } = useWatchlist();

  const asset = allAssets.find((a) => a.symbol === symbol);
  const tfConfig = getTimeframeConfig(timeframe);

  const { data: chartData } = useChartData(symbol, assetType, tfConfig.days, tfConfig.interval);

  const timeframeChange = useMemo(() => {
    if (!chartData || chartData.length < 2 || !asset) return null;
    const firstClose = (chartData[0] as { close: number }).close;
    const currentPrice = asset.price;
    if (!firstClose || firstClose <= 0) return null;
    const change = currentPrice - firstClose;
    const changePercent = (change / firstClose) * 100;
    return { change, changePercent };
  }, [chartData, asset]);

  const tfLabel = TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? "";

  const displayChange = timeframeChange?.change ?? (asset?.change24h ?? 0);
  const displayChangePercent = timeframeChange?.changePercent ?? (asset?.changePercent24h ?? 0);
  const displayIsUp = displayChange >= 0;

  const dataUpdatedAt =
    assetType === "crypto" ? crypto.dataUpdatedAt : stocks.dataUpdatedAt;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Asset not found</p>
        <Link href="/markets">
          <Button variant="outline" className="accent-border">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Markets
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/markets"
            className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors inline-flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Markets
          </Link>
          <div className="flex items-center gap-3">
            <AssetLogo symbol={asset.symbol} assetType={assetType} size={48} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">{asset.name}</h1>
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase border-[#00D4FF]/30 text-[#00D4FF]"
                >
                  {asset.asset_type}
                </Badge>
                <MarketStatusBadge
                  assetType={asset.asset_type}
                  marketState={asset.marketState}
                />
              </div>
              <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-3">
                {asset.symbol}
                <LastUpdated dataUpdatedAt={dataUpdatedAt} />
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => toggle.mutate(symbol)}
          className="accent-border hover:bg-[#00D4FF]/10"
        >
          <Heart
            className={`w-5 h-5 ${
              isWatched(symbol) ? "fill-[#00D4FF] text-[#00D4FF]" : "text-muted-foreground"
            }`}
          />
        </Button>
      </div>

      {/* Price Header */}
      <div className="flex items-end gap-4">
        <PriceFlash value={asset.price}>
          <p className="text-4xl font-bold accent-gradient">
            {formatCurrency(asset.price, (asset.price ?? 0) < 1 ? 6 : 2)}
          </p>
        </PriceFlash>
        <div
          className={`flex items-center gap-1 text-lg font-semibold pb-1 ${
            displayIsUp ? "text-green-400" : "text-[#E53E3E]"
          }`}
        >
          {displayIsUp ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
          {formatCurrency(Math.abs(displayChange))} ({formatPercent(displayChangePercent)})
          {tfLabel && (
            <span className="text-xs text-muted-foreground font-normal ml-1">
              {tfLabel}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#00D4FF]" />
                Price Chart
              </CardTitle>
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            </CardHeader>
            <CardContent>
              <PriceChart
                symbol={symbol}
                assetType={assetType}
                height={400}
                days={tfConfig.days}
                interval={tfConfig.interval}
              />
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">24h High</p>
                <p className="font-semibold text-sm text-green-400">
                  {formatCurrency(asset.high24h, (asset.high24h ?? 0) < 1 ? 6 : 2)}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">24h Low</p>
                <p className="font-semibold text-sm text-[#E53E3E]">
                  {formatCurrency(asset.low24h, (asset.low24h ?? 0) < 1 ? 6 : 2)}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Volume</p>
                <p className="font-semibold text-sm">{formatCompact(asset.volume)}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
                <p className="font-semibold text-sm">
                  {(asset.marketCap ?? 0) > 0 ? formatCompact(asset.marketCap) : "—"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Trade Panel */}
        <div>
          <TradePanel
            symbol={asset.symbol}
            name={asset.name}
            price={asset.price}
          />
        </div>
      </div>
    </div>
  );
}
