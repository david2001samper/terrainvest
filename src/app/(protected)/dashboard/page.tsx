"use client";

import { useProfile } from "@/hooks/use-profile";
import { useMarketData } from "@/hooks/use-market-data";
import { usePositions, useTrades } from "@/hooks/use-positions";
import { formatPercent, formatDateShort } from "@/lib/format";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "@/components/price-chart";
import { AnimatedNumber } from "@/components/animated-number";
import { PriceFlash } from "@/components/price-flash";
import { AssetLogo } from "@/components/asset-logo";
import { LastUpdated } from "@/components/last-updated";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { marketCardPrimaryLabel, marketCardSecondaryLabel } from "@/lib/market-display";

export default function DashboardPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { format: formatCurrency, convert, symbol, pnlPrefix } = useCurrencyFormat();
  const { allAssets, isLoading: marketLoading, crypto, stocks } = useMarketData();
  const { data: positions } = usePositions();
  const { data: trades } = useTrades(5);

  const totalPositionValue = positions?.reduce(
    (sum, p) => sum + p.quantity * (allAssets.find((a) => a.symbol === p.symbol)?.price || p.entry_price),
    0
  ) ?? 0;

  const totalUnrealizedPnl = positions?.reduce((sum, p) => {
    const currentPrice = allAssets.find((a) => a.symbol === p.symbol)?.price || p.entry_price;
    return sum + (currentPrice - p.entry_price) * p.quantity;
  }, 0) ?? 0;

  const portfolioTotal = (profile?.balance ?? 0) + totalPositionValue;

  const topMovers = [...allAssets]
    .sort((a, b) => Math.abs(b.changePercent24h ?? 0) - Math.abs(a.changePercent24h ?? 0))
    .slice(0, 6);

  const latestUpdate = Math.max(crypto.dataUpdatedAt || 0, stocks.dataUpdatedAt || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back,{" "}
            <span className="accent-gradient">
              {profile?.display_name || "Investor"}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your portfolio overview and market summary
          </p>
        </div>
        <LastUpdated dataUpdatedAt={latestUpdate || undefined} />
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card-hover accent-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Portfolio
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#00D4FF]/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-[#00D4FF]" />
              </div>
            </div>
            {profileLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-2xl font-bold accent-gradient">
                <AnimatedNumber value={convert(portfolioTotal)} prefix={symbol} />
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Cash Balance
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-blue-400" />
              </div>
            </div>
            {profileLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <p className="text-2xl font-bold">
                <AnimatedNumber value={convert(profile?.balance ?? 0)} prefix={symbol} />
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Unrealized P&L
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  totalUnrealizedPnl >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                }`}
              >
                {totalUnrealizedPnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-[#E53E3E]" />
                )}
              </div>
            </div>
            <PriceFlash value={totalUnrealizedPnl}>
              <p className={`text-2xl font-bold ${totalUnrealizedPnl >= 0 ? "text-green-400" : "text-[#E53E3E]"}`}>
                <AnimatedNumber
                  value={convert(Math.abs(totalUnrealizedPnl))}
                  prefix={pnlPrefix(totalUnrealizedPnl >= 0)}
                  decimals={2}
                />
              </p>
            </PriceFlash>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Realized P&L
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  (profile?.total_pnl ?? 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                }`}
              >
                <BarChart3
                  className={`w-4 h-4 ${
                    (profile?.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-[#E53E3E]"
                  }`}
                />
              </div>
            </div>
            {profileLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className={`text-2xl font-bold ${(profile?.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-[#E53E3E]"}`}>
                <AnimatedNumber
                  value={convert(Math.abs(profile?.total_pnl ?? 0))}
                  prefix={pnlPrefix((profile?.total_pnl ?? 0) >= 0)}
                  decimals={2}
                />
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Movers */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00D4FF]" />
              Market Movers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {marketLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topMovers.map((asset) => (
                  <Link
                    key={asset.symbol}
                    href={`/markets/${encodeURIComponent(asset.symbol)}?type=${asset.asset_type}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-accent/50 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AssetLogo
                        symbol={asset.symbol}
                        assetType={asset.asset_type}
                        coingeckoId={asset.coingecko_id}
                        size={32}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm group-hover:text-[#00D4FF] transition-colors">
                          {marketCardPrimaryLabel(asset)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {marketCardSecondaryLabel(asset)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <PriceFlash value={asset.price}>
                        <p className="font-medium text-sm">
                          {formatCurrency(asset.price, (asset.price ?? 0) < 1 ? 6 : 2)}
                        </p>
                      </PriceFlash>
                      <div
                        className={`flex items-center justify-end gap-0.5 text-xs font-medium ${
                          (asset.changePercent24h ?? 0) >= 0 ? "text-green-400" : "text-[#E53E3E]"
                        }`}
                      >
                        {(asset.changePercent24h ?? 0) >= 0 ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {formatPercent(asset.changePercent24h)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00D4FF]" />
                Recent Activity
              </CardTitle>
              <Link
                href="/history"
                className="text-xs text-[#00D4FF] hover:text-[#22D3EE] transition-colors"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!trades || trades.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3">
                {trades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        className={`text-[10px] uppercase font-bold px-2 ${
                          trade.side === "buy"
                            ? "bg-green-600/20 text-green-400 border-green-600/30"
                            : "bg-red-600/20 text-[#E53E3E] border-red-600/30"
                        }`}
                      >
                        {trade.side}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{trade.symbol}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateShort(trade.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="font-medium text-sm">{formatCurrency(trade.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Chart - BTC */}
      {!marketLoading && allAssets.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AssetLogo symbol="BTC" assetType="crypto" fetchMode="eager" size={24} />
              Bitcoin (BTC) — 30 Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart symbol="BTC" assetType="crypto" height={250} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
