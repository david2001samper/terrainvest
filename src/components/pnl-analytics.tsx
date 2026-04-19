"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  CalendarDays,
  BarChart2,
} from "lucide-react";

// Recharts is ~90 KB gzipped — load it only when the user actually views
// the cumulative-P&L chart, not on every page mount.
const PnlCumulativeChart = dynamic(
  () => import("@/components/pnl-cumulative-chart"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
  }
);

interface DayPnl {
  date: string;
  pnl: number;
  cumulative: number;
}

interface SymbolBreakdown {
  symbol: string;
  totalPnl: number;
  tradeCount: number;
  wins: number;
  winRate: number;
}

interface PnlData {
  dailyPnl: DayPnl[];
  todayPnl: number;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  symbols: SymbolBreakdown[];
}

interface PnlAnalyticsProps {
  /** Live mark-to-market unrealized P&L from all open positions.
   *  Computed by the parent (portfolio page) from current prices. */
  liveUnrealizedPnl?: number;
}

export function PnlAnalytics({ liveUnrealizedPnl }: PnlAnalyticsProps = {}) {
  const { format: formatCurrency } = useCurrencyFormat();
  const tzOffsetMinutes = new Date().getTimezoneOffset();

  const { data, isLoading, isError } = useQuery<PnlData>({
    queryKey: ["analytics", "pnl", tzOffsetMinutes],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/pnl?tzOffsetMinutes=${encodeURIComponent(String(tzOffsetMinutes))}`
      );
      if (!res.ok) throw new Error("Failed to load P&L data");
      return res.json();
    },
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="glass-card">
        <CardContent className="p-12 text-center">
          <Activity className="w-10 h-10 text-destructive mx-auto mb-3 opacity-60" />
          <p className="text-muted-foreground">
            Failed to load P&L data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalTrades === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-12 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-60" />
          <p className="text-muted-foreground">
            No trade history yet. Start trading to see your P&L analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPositiveTotal    = data.totalPnl >= 0;
  const isPositiveToday    = data.todayPnl >= 0;
  const hasUnrealized      = liveUnrealizedPnl != null;
  const isPositiveUnreal   = (liveUnrealizedPnl ?? 0) >= 0;
  const chartColor         = isPositiveTotal ? "#22C55E" : "#E53E3E";

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 gap-4 ${hasUnrealized ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Card className="glass-card-hover accent-border">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              {isPositiveTotal ? (
                <TrendingUp className="w-3 h-3 text-green-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )}
              Total Realized P&L
            </p>
            <p
              className={`text-2xl font-bold ${
                isPositiveTotal ? "text-green-400" : "text-red-400"
              }`}
            >
              {isPositiveTotal ? "+" : ""}
              {formatCurrency(data.totalPnl)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Today&apos;s Realized P&L
            </p>
            <p
              className={`text-2xl font-bold ${
                isPositiveToday ? "text-green-400" : "text-red-400"
              }`}
            >
              {isPositiveToday ? "+" : ""}
              {formatCurrency(data.todayPnl)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Closed trades today</p>
          </CardContent>
        </Card>

        {hasUnrealized && (
          <Card className="glass-card-hover">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <BarChart2 className="w-3 h-3 text-[#00D4FF]" />
                Live Unrealized P&L
              </p>
              <p
                className={`text-2xl font-bold ${
                  isPositiveUnreal ? "text-green-400" : "text-red-400"
                }`}
              >
                {isPositiveUnreal ? "+" : ""}
                {formatCurrency(liveUnrealizedPnl!)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Open positions (live)</p>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card-hover">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Win Rate
            </p>
            <p className="text-2xl font-bold accent-gradient">
              {data.winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalTrades} realized trades
            </p>
          </CardContent>
        </Card>
      </div>

      {data.dailyPnl.length > 1 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00D4FF]" />
              Cumulative P&L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PnlCumulativeChart
              data={data.dailyPnl}
              chartColor={chartColor}
              formatCurrency={formatCurrency}
            />
          </CardContent>
        </Card>
      )}

      {data.symbols.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">P&L by Symbol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">
                      Symbol
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      Total P&L
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      Trades
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      Win Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.symbols.map((s) => (
                    <TableRow
                      key={s.symbol}
                      className="border-border hover:bg-accent/30"
                    >
                      <TableCell className="font-medium">{s.symbol}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-medium ${
                            s.totalPnl >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {s.totalPnl >= 0 ? "+" : ""}
                          {formatCurrency(s.totalPnl)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{s.tradeCount}</TableCell>
                      <TableCell className="text-right">
                        {s.winRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
