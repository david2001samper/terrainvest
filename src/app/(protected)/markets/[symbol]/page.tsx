"use client";

import { useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMarketData, useChartData, useLiveChartData } from "@/hooks/use-market-data";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useOrderBook } from "@/hooks/use-order-book";
import { useProfile } from "@/hooks/use-profile";
import { PriceChart } from "@/components/price-chart";
import { TradePanel } from "@/components/trade-panel";
import { OrderBook } from "@/components/order-book";
import { DepthChart } from "@/components/depth-chart";
import { AssetNews } from "@/components/asset-news";
import { AssetLogo } from "@/components/asset-logo";
import { PriceFlash } from "@/components/price-flash";
import { LastUpdated } from "@/components/last-updated";
import { MarketStatusBadge } from "@/components/market-status-badge";
import {
  TimeframeSelector,
  getTimeframeConfig,
  TIMEFRAMES,
  type TimeframeValue,
} from "@/components/timeframe-selector";
import { formatPercent } from "@/lib/format";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
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
  Activity,
  Newspaper,
} from "lucide-react";
import Link from "next/link";
import type { MarketAsset } from "@/lib/types";
import { stripYahooInstrumentSuffixes } from "@/lib/market-display";

type ChartViewMode = "price" | "volume" | "news";

export default function AssetDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { format: formatCurrency, formatCompact } = useCurrencyFormat();
  const symbol = decodeURIComponent(params.symbol as string);
  const assetType = searchParams.get("type") || "stock";
  const [timeframe, setTimeframe] = useState<TimeframeValue>("1m");
  const [chartMode, setChartMode] = useState<ChartViewMode>("price");

  const { allAssets, isLoading, crypto, stocks, forex } = useMarketData();
  const { isWatched, toggle } = useWatchlist();

  const listAsset = useMemo(() => {
    const u = symbol.toUpperCase();
    return (
      allAssets.find(
        (a) => a.symbol === symbol || a.symbol.toUpperCase() === u
      ) ?? null
    );
  }, [allAssets, symbol]);

  const cgFromUrl = searchParams.get("cg");
  const needsDynamicQuote = !listAsset;

  const {
    data: dynamicAsset,
    isLoading: quoteLoading,
    isError: quoteError,
    dataUpdatedAt: quoteDataUpdatedAt,
  } = useQuery<MarketAsset>({
    queryKey: ["market", "quote", symbol, assetType, cgFromUrl ?? ""],
    queryFn: async () => {
      const p = new URLSearchParams({ symbol, type: assetType });
      if (cgFromUrl) p.set("cg_id", cgFromUrl);
      const res = await fetch(`/api/market/quote?${p}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "not found");
      }
      return (await res.json()) as MarketAsset;
    },
    enabled: Boolean(symbol) && !isLoading && needsDynamicQuote,
    refetchInterval: 10_000,
    staleTime: 4000,
  });

  const asset = listAsset ?? dynamicAsset ?? null;
  const resolvedType = asset?.asset_type ?? assetType;
  const coingeckoId =
    resolvedType === "crypto"
      ? cgFromUrl ||
        listAsset?.coingecko_id ||
        dynamicAsset?.coingecko_id ||
        null
      : null;

  const isLive = timeframe === "live";
  const tfConfig = getTimeframeConfig(timeframe);

  // Historical chart data (disabled during live mode)
  const { data: chartData } = useChartData(
    symbol,
    resolvedType,
    isLive ? 1 : tfConfig.days,
    isLive ? "5m" : tfConfig.interval,
    coingeckoId,
    !isLive
  );

  // Live chart data
  const effectiveDataUpdatedAt =
    listAsset != null
      ? resolvedType === "crypto"
        ? crypto.dataUpdatedAt
        : resolvedType === "forex"
        ? forex.dataUpdatedAt
        : stocks.dataUpdatedAt
      : quoteDataUpdatedAt;

  const liveData = useLiveChartData(
    asset?.price ?? 0,
    asset?.volume ?? 0,
    effectiveDataUpdatedAt,
    isLive
  );

  // Timeframe change computation
  const timeframeChange = useMemo(() => {
    if (isLive) {
      if (liveData.length < 2) return null;
      const firstPrice = liveData[0].price;
      const currentPrice = liveData[liveData.length - 1].price;
      if (!firstPrice || firstPrice <= 0) return null;
      const change = currentPrice - firstPrice;
      const changePercent = (change / firstPrice) * 100;
      return { change, changePercent };
    }
    if (!chartData || chartData.length < 2 || !asset) return null;
    const firstClose = (chartData[0] as { close: number }).close;
    const currentPrice = asset.price;
    if (!firstClose || firstClose <= 0) return null;
    const change = currentPrice - firstClose;
    const changePercent = (change / firstClose) * 100;
    return { change, changePercent };
  }, [isLive, liveData, chartData, asset]);

  const tfLabel =
    isLive
      ? "Live"
      : TIMEFRAMES.find((t) => t.value === timeframe)?.label ?? "";

  const displayChange = timeframeChange?.change ?? (asset?.change24h ?? 0);
  const displayChangePercent =
    timeframeChange?.changePercent ?? (asset?.changePercent24h ?? 0);
  const displayIsUp = displayChange >= 0;

  const dataUpdatedAt =
    listAsset != null
      ? resolvedType === "crypto"
        ? crypto.dataUpdatedAt
        : resolvedType === "forex"
        ? forex.dataUpdatedAt
        : stocks.dataUpdatedAt
      : undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (needsDynamicQuote && quoteLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!asset || (needsDynamicQuote && quoteError)) {
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
            <AssetLogo
              symbol={asset.symbol}
              assetType={resolvedType}
              coingeckoId={coingeckoId}
              fetchMode="eager"
              size={48}
            />
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
                {stripYahooInstrumentSuffixes(asset.symbol)}
                <LastUpdated dataUpdatedAt={dataUpdatedAt} />
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => toggle.mutate(asset.symbol)}
          className="accent-border hover:bg-[#00D4FF]/10"
        >
          <Heart
            className={`w-5 h-5 ${
              isWatched(asset.symbol)
                ? "fill-[#00D4FF] text-[#00D4FF]"
                : "text-muted-foreground"
            }`}
          />
        </Button>
      </div>

      {/* Price Header */}
      <div className="flex items-end gap-4">
        <PriceFlash value={asset.price}>
          <p className="text-4xl font-bold accent-gradient">
            {formatCurrency(
              asset.price,
              (asset.price ?? 0) < 1 ? 6 : 2
            )}
          </p>
        </PriceFlash>
        <div
          className={`flex items-center gap-1 text-lg font-semibold pb-1 ${
            displayIsUp ? "text-green-400" : "text-[#E53E3E]"
          }`}
        >
          {displayIsUp ? (
            <ArrowUpRight className="w-5 h-5" />
          ) : (
            <ArrowDownRight className="w-5 h-5" />
          )}
          {formatCurrency(Math.abs(displayChange))} (
          {formatPercent(displayChangePercent)})
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
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {chartMode === "volume" ? (
                      <BarChart3 className="w-4 h-4 text-[#00D4FF]" />
                    ) : chartMode === "news" ? (
                      <Newspaper className="w-4 h-4 text-[#00D4FF]" />
                    ) : (
                      <Activity className="w-4 h-4 text-[#00D4FF]" />
                    )}
                    {chartMode === "volume"
                      ? "Volume"
                      : chartMode === "news"
                      ? "News"
                      : "Price Chart"}
                  </CardTitle>
                  <div className="flex p-0.5 rounded-md bg-background/60 border border-border">
                    {(
                      [
                        { key: "price", label: "Price" },
                        { key: "volume", label: "Volume" },
                        { key: "news", label: "News" },
                      ] as { key: ChartViewMode; label: string }[]
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setChartMode(tab.key)}
                        className={`px-2.5 py-1 text-[11px] rounded font-medium transition-all ${
                          chartMode === tab.key
                            ? "bg-[#00D4FF]/15 text-[#00D4FF]"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                {chartMode !== "news" && (
                  <TimeframeSelector
                    value={timeframe}
                    onChange={setTimeframe}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {chartMode === "news" ? (
                <AssetNews symbol={symbol} />
              ) : (
                <PriceChart
                  symbol={symbol}
                  assetType={resolvedType}
                  height={400}
                  days={isLive ? 1 : tfConfig.days}
                  interval={isLive ? "5m" : tfConfig.interval}
                  coingeckoId={coingeckoId}
                  chartMode={chartMode === "volume" ? "volume" : "price"}
                  liveData={isLive ? liveData : undefined}
                />
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">24h High</p>
                <p className="font-semibold text-sm text-green-400">
                  {formatCurrency(
                    asset.high24h,
                    (asset.high24h ?? 0) < 1 ? 6 : 2
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">24h Low</p>
                <p className="font-semibold text-sm text-[#E53E3E]">
                  {formatCurrency(
                    asset.low24h,
                    (asset.low24h ?? 0) < 1 ? 6 : 2
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Volume</p>
                <p className="font-semibold text-sm">
                  {formatCompact(asset.volume)}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Market Cap</p>
                <p className="font-semibold text-sm">
                  {(asset.marketCap ?? 0) > 0
                    ? formatCompact(asset.marketCap)
                    : "—"}
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
            bid={asset.bid}
            ask={asset.ask}
            spreadPips={asset.spreadPips}
            assetType={resolvedType}
          />
        </div>
      </div>

      {/* Order Book & Depth Chart */}
      <OrderBookSection symbol={asset.symbol} assetType={resolvedType} />
    </div>
  );
}

function OrderBookSection({
  symbol,
  assetType,
}: {
  symbol: string;
  assetType: string;
}) {
  const { data: profile } = useProfile();
  const canView = profile?.can_view_order_book ?? false;
  const { data, isLoading } = useOrderBook(symbol, assetType, canView);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <OrderBook symbol={symbol} assetType={assetType} />
      {canView && (
        <DepthChart data={data} isLoading={isLoading} />
      )}
    </div>
  );
}
