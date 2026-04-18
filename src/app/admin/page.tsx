"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  BarChart3,
  DollarSign,
  TrendingUp,
  Activity,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";

export default function AdminDashboard() {
  const { data: analytics, isLoading, isError } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
