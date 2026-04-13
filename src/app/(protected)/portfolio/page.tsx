"use client";

import { useState } from "react";
import { usePositions } from "@/hooks/use-positions";
import { useMarketData } from "@/hooks/use-market-data";
import { useProfile } from "@/hooks/use-profile";
import { useOptionsPositions } from "@/hooks/use-options-positions";
import { formatPercent } from "@/lib/format";
import { positionRowLabel } from "@/lib/market-display";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AnimatedNumber } from "@/components/animated-number";
import { PriceFlash } from "@/components/price-flash";
import { AssetLogo } from "@/components/asset-logo";
import { AssetAllocationChart } from "@/components/asset-allocation-chart";
import { LastUpdated } from "@/components/last-updated";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { PnlAnalytics } from "@/components/pnl-analytics";
import { OptionsGreeks } from "@/components/options-greeks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  BarChart3,
  Activity,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import Link from "next/link";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type PortfolioTab = "holdings" | "pnl";

type ForexPositionRow = {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  units_signed: number;
  avg_entry_price: number;
  leverage: number;
  margin_used_usd: number;
  swap_accrued_usd: number;
  mid: number;
  bid: number;
  ask: number;
  spreadPips: number;
  mark: number;
  unrealized_pnl_usd: number;
};

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<PortfolioTab>("holdings");
  const [allocationView, setAllocationView] = useState<"asset_class" | "holdings">("asset_class");
  const [sellingOption, setSellingOption] = useState<string | null>(null);
  const { format: formatCurrency, convert, symbol, pnlPrefix } = useCurrencyFormat();
  const { data: positions, isLoading } = usePositions();
  const { allAssets, crypto, stocks } = useMarketData();
  const { data: profile } = useProfile();
  const { data: optionsPositions, isLoading: optionsLoading } = useOptionsPositions();
  const { data: forexPositions = [] } = useQuery<ForexPositionRow[]>({
    queryKey: ["forex-positions"],
    queryFn: async () => {
      const res = await fetch("/api/forex/positions");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 8000,
  });
  const queryClient = useQueryClient();

  const enrichedPositions = positions?.map((pos) => {
    const marketData = allAssets.find((a) => a.symbol === pos.symbol);
    const currentPrice = marketData?.price || pos.entry_price;
    const currentValue = pos.quantity * currentPrice;
    const unrealizedPnl = (currentPrice - pos.entry_price) * pos.quantity;
    const unrealizedPnlPercent =
      pos.entry_price > 0 ? ((currentPrice - pos.entry_price) / pos.entry_price) * 100 : 0;
    const assetType =
      marketData?.asset_type ||
      (pos as { asset_type?: string }).asset_type ||
      "stock";

    return {
      ...pos,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPercent,
      assetType,
      marketState: marketData?.marketState,
      displayName: positionRowLabel(pos.symbol, assetType, marketData?.name),
      coingeckoId: marketData?.coingecko_id,
    };
  }) || [];

  const totalValue = enrichedPositions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnl = enrichedPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalInvested = enrichedPositions.reduce(
    (sum, p) => sum + p.entry_price * p.quantity,
    0
  );

  const portfolioTotal = (profile?.balance ?? 0) + totalValue;
  const totalReturn = (profile?.total_pnl ?? 0) + totalPnl;
  const initialBalance = portfolioTotal - totalReturn;
  const totalReturnPercent =
    initialBalance > 0 ? (totalReturn / initialBalance) * 100 : 0;

  const latestUpdate = Math.max(crypto.dataUpdatedAt || 0, stocks.dataUpdatedAt || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#00D4FF]" />
            Portfolio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your active positions and performance
          </p>
        </div>
        <LastUpdated dataUpdatedAt={latestUpdate || undefined} />
      </div>

      {/* Tab Strip */}
      <div className="flex p-0.5 rounded-md bg-background/60 border border-border w-fit">
        <button
          onClick={() => setActiveTab("holdings")}
          className={`px-4 py-1.5 text-sm rounded font-medium transition-all ${
            activeTab === "holdings"
              ? "bg-[#00D4FF]/15 text-[#00D4FF]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Holdings
        </button>
        <button
          onClick={() => setActiveTab("pnl")}
          className={`px-4 py-1.5 text-sm rounded font-medium transition-all ${
            activeTab === "pnl"
              ? "bg-[#00D4FF]/15 text-[#00D4FF]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          P&L Analytics
        </button>
      </div>

      {activeTab === "pnl" ? (
        <PnlAnalytics />
      ) : (
      <>
      {/* Performance */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00D4FF]" />
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-4">
            <p className="text-2xl font-bold accent-gradient">
              <AnimatedNumber value={convert(portfolioTotal)} prefix={symbol} />
            </p>
            <p
              className={`text-lg font-medium ${
                totalReturn >= 0 ? "text-green-400" : "text-[#E53E3E]"
              }`}
            >
              {totalReturn >= 0 ? "+" : ""}
              {formatCurrency(totalReturn)} ({formatPercent(totalReturnPercent)})
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            All-time return (realized + unrealized)
          </p>
          <div className="flex gap-3 mt-4">
            <Link href="/deposits">
              <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold h-9 px-5">
                <ArrowDownToLine className="w-4 h-4 mr-1.5" />
                Deposit
              </Button>
            </Link>
            <Link href="/withdrawals">
              <Button variant="outline" className="accent-border hover:bg-[#00D4FF]/10 font-semibold h-9 px-5">
                <ArrowUpFromLine className="w-4 h-4 mr-1.5" />
                Withdraw
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card-hover accent-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Position Value
            </p>
            <p className="text-2xl font-bold accent-gradient">
              <AnimatedNumber value={convert(totalValue)} prefix={symbol} />
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Total Invested
            </p>
            <p className="text-2xl font-bold">
              <AnimatedNumber value={convert(totalInvested)} prefix={symbol} />
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Unrealized P&L
            </p>
            <PriceFlash value={totalPnl}>
              <p className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-400" : "text-[#E53E3E]"}`}>
                <AnimatedNumber
                  value={convert(Math.abs(totalPnl))}
                  prefix={pnlPrefix(totalPnl >= 0)}
                />
              </p>
            </PriceFlash>
          </CardContent>
        </Card>
        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Positions
            </p>
            <p className="text-2xl font-bold">{enrichedPositions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Asset Allocation Pie Chart */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#00D4FF]" />
              Asset Allocation
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={allocationView === "asset_class" ? "default" : "outline"}
                size="sm"
                onClick={() => setAllocationView("asset_class")}
                className={
                  allocationView === "asset_class"
                    ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40"
                    : ""
                }
              >
                By Class
              </Button>
              <Button
                variant={allocationView === "holdings" ? "default" : "outline"}
                size="sm"
                onClick={() => setAllocationView("holdings")}
                className={
                  allocationView === "holdings"
                    ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40"
                    : ""
                }
              >
                By Holdings
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AssetAllocationChart
            positions={enrichedPositions.map((p) => ({
              symbol: p.symbol,
              currentValue: p.currentValue,
              assetType: p.assetType,
            }))}
            cashBalance={profile?.balance ?? 0}
            viewMode={allocationView}
            currency={profile?.preferred_currency ?? "USD"}
            formatValue={(v) => formatCurrency(v)}
          />
        </CardContent>
      </Card>

      {/* Options Positions */}
      {(optionsPositions ?? []).length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00D4FF]" />
              Options Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Contract</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Strike</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Expiry</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Qty</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Entry</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Current</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">P&L</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Greeks</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(optionsPositions ?? []).map((op) => {
                    const curPrem = op.current_premium ?? op.entry_premium;
                    const unrealPnl = (curPrem - op.entry_premium) * op.quantity * 100;
                    const isUp = unrealPnl >= 0;
                    return (
                      <TableRow key={op.id} className="border-border hover:bg-accent/30">
                        <TableCell className="font-medium text-sm">
                          {op.contract_symbol}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${
                              op.option_type === "call"
                                ? "border-green-500/40 text-green-400"
                                : "border-red-500/40 text-red-400"
                            }`}
                          >
                            {op.option_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(op.strike, 2)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(op.expiry).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {op.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(op.entry_premium, 2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(curPrem, 2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
                            {isUp ? "+" : ""}
                            {formatCurrency(unrealPnl, 2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <OptionsGreeks
                            delta={(op as Record<string, unknown>).delta as number | undefined}
                            gamma={(op as Record<string, unknown>).gamma as number | undefined}
                            theta={(op as Record<string, unknown>).theta as number | undefined}
                            vega={(op as Record<string, unknown>).vega as number | undefined}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                            disabled={sellingOption === op.id}
                            onClick={async () => {
                              setSellingOption(op.id);
                              try {
                                const res = await fetch("/api/options/trade", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "sell",
                                    position_id: op.id,
                                    quantity: op.quantity,
                                    premium: curPrem,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  toast.error(data.error || "Sell failed");
                                  return;
                                }
                                toast.success(data.message);
                                queryClient.invalidateQueries({ queryKey: ["options-positions"] });
                                queryClient.invalidateQueries({ queryKey: ["profile"] });
                              } catch {
                                toast.error("Sell failed");
                              } finally {
                                setSellingOption(null);
                              }
                            }}
                          >
                            {sellingOption === op.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Sell"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forex Positions */}
      {forexPositions.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00D4FF]" />
              Forex Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Pair</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Lots</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Entry</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Mark</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">P&L</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forexPositions.map((fp) => {
                    const lots = Math.abs(fp.units_signed) / 100000;
                    const isUp = fp.unrealized_pnl_usd >= 0;
                    return (
                      <TableRow key={fp.id} className="border-border hover:bg-accent/30">
                        <TableCell className="font-medium">
                          {fp.base}/{fp.quote}{" "}
                          <span className="text-xs text-muted-foreground">({fp.symbol})</span>
                        </TableCell>
                        <TableCell className="text-right">{lots.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(fp.avg_entry_price, fp.avg_entry_price < 1 ? 6 : 4)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(fp.mark, fp.mark < 1 ? 6 : 4)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
                            {isUp ? "+" : ""}
                            {formatCurrency(fp.unrealized_pnl_usd, 2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(fp.margin_used_usd, 2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#00D4FF]" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : enrichedPositions.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-60" />
              <p className="text-muted-foreground mb-2">No open positions</p>
              <Link
                href="/markets"
                className="text-[#00D4FF] hover:text-[#22D3EE] text-sm font-medium"
              >
                Explore Markets →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Asset</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Quantity</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Entry Price</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Current Price</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Value</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedPositions.map((pos) => (
                    <TableRow key={pos.id} className="border-border hover:bg-accent/30">
                      <TableCell>
                        <Link
                          href={`/markets/${encodeURIComponent(pos.symbol)}?type=${pos.assetType}`}
                          className="flex items-center gap-3 hover:text-[#00D4FF] transition-colors"
                        >
                          <AssetLogo
                            symbol={pos.symbol}
                            assetType={pos.assetType}
                            coingeckoId={pos.coingeckoId}
                            size={32}
                          />
                          <div>
                            <p className="font-medium">{pos.displayName}</p>
                            <Badge variant="outline" className="text-[9px] uppercase mt-0.5 border-border">
                              {pos.assetType}
                            </Badge>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <MarketStatusBadge assetType={pos.assetType} marketState={pos.marketState} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(pos.entry_price, pos.entry_price < 1 ? 6 : 2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <PriceFlash value={pos.currentPrice}>
                          {formatCurrency(pos.currentPrice, pos.currentPrice < 1 ? 6 : 2)}
                        </PriceFlash>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <AnimatedNumber value={convert(pos.currentValue)} prefix={symbol} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={`flex items-center justify-end gap-1 font-medium ${
                            pos.unrealizedPnl >= 0 ? "text-green-400" : "text-[#E53E3E]"
                          }`}
                        >
                          {pos.unrealizedPnl >= 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          <span>{formatCurrency(Math.abs(pos.unrealizedPnl))}</span>
                          <span className="text-xs text-foreground/70">
                            ({formatPercent(pos.unrealizedPnlPercent)})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
