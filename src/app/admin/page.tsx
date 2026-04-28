"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  BarChart3,
  DollarSign,
  TrendingUp,
  Activity,
  PieChart,
  X,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";

interface ClientPnlStats {
  userId: string;
  email: string;
  displayName: string | null;
  balance: number;
  totalPnl: number;
  todayPnl: number;
  todayTrades: number;
  totalTrades: number;
  totalWins: number;
  winRate: number;
}

export default function AdminDashboard() {
  const [pnlStatsOpen, setPnlStatsOpen] = useState(false);

  const { data: analytics, isLoading, isError } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: pnlStats, isLoading: pnlStatsLoading } = useQuery<{
    clients: ClientPnlStats[];
    summary: {
      totalClients: number;
      clientsWithTrades: number;
      platformTotalPnl: number;
      platformTodayPnl: number;
      platformTotalTrades: number;
      platformTodayTrades: number;
    };
  }>({
    queryKey: ["admin", "pnl-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/clients/pnl-stats");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: pnlStatsOpen,
    staleTime: 30000,
  });

  const stats = [
    {
      label: "Total Clients",
      value: analytics?.totalClients || 0,
      format: (v: number) => v.toString(),
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Total Trades",
      value: analytics?.totalTrades || 0,
      format: (v: number) => formatNumber(v, 0),
      icon: Activity,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Total Volume",
      value: analytics?.totalVolume || 0,
      format: formatCurrency,
      icon: BarChart3,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Total Client Balances",
      value: analytics?.totalBalances || 0,
      format: formatCurrency,
      icon: DollarSign,
      color: "text-[#00D4FF]",
      bg: "bg-[#00D4FF]/10",
    },
    {
      label: "Platform P&L",
      value: analytics?.totalPnl || 0,
      format: formatCurrency,
      icon: TrendingUp,
      color: analytics?.totalPnl >= 0 ? "text-green-400" : "text-red-400",
      bg: analytics?.totalPnl >= 0 ? "bg-green-500/10" : "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PlatformLogo size={96} />
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Platform overview and management</p>
        </div>
      </div>

      {isError && (
        <Card className="glass-card border-red-500/30">
          <CardContent className="p-4 text-sm text-red-400">
            Failed to load live admin analytics. The summary below may be incomplete.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className={`text-xl font-bold ${stat.color}`}>
                  {stat.format(stat.value)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/admin/clients"
              className="p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-all text-center"
            >
              <Users className="w-6 h-6 mx-auto mb-2 text-blue-400" />
              <p className="text-sm font-medium">Manage Clients</p>
              <p className="text-xs text-muted-foreground">View, edit balances</p>
            </Link>
            <Link
              href="/admin/trades"
              className="p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-all text-center"
            >
              <Activity className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <p className="text-sm font-medium">View All Trades</p>
              <p className="text-xs text-muted-foreground">Full trade history</p>
            </Link>
            <Link
              href="/admin/assets"
              className="p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-all text-center"
            >
              <BarChart3 className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <p className="text-sm font-medium">Manage Assets</p>
              <p className="text-xs text-muted-foreground">Add new symbols</p>
            </Link>
            <button
              onClick={() => setPnlStatsOpen(true)}
              className="p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-all text-center"
            >
              <PieChart className="w-6 h-6 mx-auto mb-2 text-[#00D4FF]" />
              <p className="text-sm font-medium">All Clients P&L</p>
              <p className="text-xs text-muted-foreground">View statistics</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={pnlStatsOpen} onOpenChange={setPnlStatsOpen}>
        <DialogContent className="glass-card accent-border max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#00D4FF]" />
              All Clients P&L Statistics
            </DialogTitle>
          </DialogHeader>

          {pnlStatsLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : pnlStats ? (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-shrink-0">
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Total Clients</p>
                  <p className="text-lg font-bold">{pnlStats.summary.totalClients}</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Active Traders</p>
                  <p className="text-lg font-bold">{pnlStats.summary.clientsWithTrades}</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Platform Total P&L</p>
                  <p className={`text-lg font-bold ${pnlStats.summary.platformTotalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnlStats.summary.platformTotalPnl >= 0 ? "+" : ""}
                    {formatCurrency(pnlStats.summary.platformTotalPnl)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Today&apos;s P&L</p>
                  <p className={`text-lg font-bold ${pnlStats.summary.platformTodayPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnlStats.summary.platformTodayPnl >= 0 ? "+" : ""}
                    {formatCurrency(pnlStats.summary.platformTodayPnl)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Total Trades</p>
                  <p className="text-lg font-bold">{formatNumber(pnlStats.summary.platformTotalTrades, 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border">
                  <p className="text-[10px] uppercase text-muted-foreground">Today&apos;s Trades</p>
                  <p className="text-lg font-bold">{pnlStats.summary.platformTodayTrades}</p>
                </div>
              </div>

              <div className="flex-1 overflow-auto border border-border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase text-muted-foreground">Client</TableHead>
                      <TableHead className="text-[10px] uppercase text-muted-foreground text-right">Balance</TableHead>
                      <TableHead className="text-[10px] uppercase text-muted-foreground text-right">Total P&L</TableHead>
                      <TableHead className="text-[10px] uppercase text-muted-foreground text-right">Today P&L</TableHead>
                      <TableHead className="text-[10px] uppercase text-muted-foreground text-right">Trades</TableHead>
                      <TableHead className="text-[10px] uppercase text-muted-foreground text-right">Today</TableHead>
                      <TableHead className="text-[10px] uppercase text-muted-foreground text-right">Win Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pnlStats.clients.map((client) => (
                      <TableRow key={client.userId} className="border-border hover:bg-accent/30">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{client.displayName || "—"}</p>
                            <p className="text-xs text-muted-foreground">{client.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency(client.balance)}
                        </TableCell>
                        <TableCell className={`text-right font-medium text-sm ${client.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {client.totalPnl >= 0 ? "+" : ""}
                          {formatCurrency(client.totalPnl)}
                        </TableCell>
                        <TableCell className={`text-right font-medium text-sm ${client.todayPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {client.todayPnl >= 0 ? "+" : ""}
                          {formatCurrency(client.todayPnl)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{client.totalTrades}</TableCell>
                        <TableCell className="text-right text-sm">{client.todayTrades}</TableCell>
                        <TableCell className="text-right text-sm">
                          {client.totalTrades > 0 ? `${client.winRate.toFixed(1)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {pnlStats.clients.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No clients found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end flex-shrink-0">
                <Button variant="outline" onClick={() => setPnlStatsOpen(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
