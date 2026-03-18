"use client";

import { useChartData } from "@/hooks/use-market-data";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface PriceChartProps {
  symbol: string;
  assetType: string;
  height?: number;
  minimal?: boolean;
  days?: number;
  interval?: string;
  coingeckoId?: string | null;
}

export function PriceChart({
  symbol,
  assetType,
  height = 300,
  minimal = false,
  days = 30,
  interval = "1d",
  coingeckoId,
}: PriceChartProps) {
  const { format: formatCurrency, convert, symbol: currencySymbol } = useCurrencyFormat();
  const { data, isLoading } = useChartData(symbol, assetType, days, interval, coingeckoId);

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        No chart data available
      </div>
    );
  }

  const chartData = data.map((d: { time: string; close: number; volume: number }) => {
    const date = new Date(d.time);
    const label =
      days <= 1
        ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : days <= 7
        ? date.toLocaleDateString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { time: label, price: d.close, volume: d.volume };
  });

  const prices = chartData.map((d: { price: number }) => d.price).filter(Boolean);
  if (prices.length === 0) return null;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const isUp = chartData[chartData.length - 1]?.price >= chartData[0]?.price;
  const color = isUp ? "#22C55E" : "#E53E3E";

  if (minimal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`g-${symbol}-${days}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="price" stroke={color} fill={`url(#g-${symbol}-${days})`} strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`gf-${symbol}-${days}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,174,192,0.06)" />
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#718096", fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minPrice * 0.998, maxPrice * 1.002]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#718096", fontSize: 11 }}
          tickFormatter={(v: number) => {
            const vc = convert(v);
            if (vc >= 1000) return `${currencySymbol}${(vc / 1000).toFixed(1)}k`;
            return formatCurrency(vc, vc >= 1 ? 2 : vc >= 0.01 ? 4 : 6);
          }}
          width={65}
        />
        <Tooltip
          contentStyle={{
            background: "#151822",
            border: "1px solid rgba(160,174,192,0.15)",
            borderRadius: "8px",
            color: "#E2E8F0",
            fontSize: 13,
          }}
          formatter={(value) => [formatCurrency(Number(value)), "Price"]}
        />
        <Area type="monotone" dataKey="price" stroke={color} fill={`url(#gf-${symbol}-${days})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
