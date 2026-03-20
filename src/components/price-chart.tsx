"use client";

import { useChartData, type LivePoint } from "@/hooks/use-market-data";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  BarChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

interface PriceChartProps {
  symbol: string;
  assetType: string;
  height?: number;
  minimal?: boolean;
  days?: number;
  interval?: string;
  coingeckoId?: string | null;
  chartMode?: "price" | "volume";
  liveData?: LivePoint[];
}

export function PriceChart({
  symbol,
  assetType,
  height = 300,
  minimal = false,
  days = 30,
  interval = "1d",
  coingeckoId,
  chartMode = "price",
  liveData,
}: PriceChartProps) {
  const { format: formatCurrency, convert, symbol: currencySymbol } = useCurrencyFormat();
  const isLive = Boolean(liveData);
  const { data: fetchedData, isLoading } = useChartData(
    symbol,
    assetType,
    days,
    interval,
    coingeckoId,
    !isLive
  );

  if (!isLive && isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  // Build chart data from either live buffer or fetched historical data
  let chartData: { time: string; price: number; volume: number; isUp: boolean }[];

  if (isLive) {
    if (!liveData || liveData.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center text-muted-foreground gap-2"
          style={{ height }}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Waiting for live data...
        </div>
      );
    }
    chartData = liveData.map((d, i) => ({
      time: d.time,
      price: d.price,
      volume: d.volume,
      isUp: i > 0 ? d.price >= liveData[i - 1].price : true,
    }));
  } else {
    const raw = fetchedData ?? [];
    if (raw.length === 0) {
      return (
        <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
          No chart data available
        </div>
      );
    }
    chartData = raw.map(
      (d: { time: string; close: number; volume: number }, i: number, arr: { close: number }[]) => {
        const date = new Date(d.time);
        const label =
          days <= 1
            ? date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
            : days <= 7
            ? date.toLocaleDateString("en-US", {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const prevClose = i > 0 ? arr[i - 1].close : d.close;
        return {
          time: label,
          price: d.close,
          volume: d.volume || 0,
          isUp: d.close >= prevClose,
        };
      }
    );
  }

  const prices = chartData.map((d) => d.price).filter(Boolean);
  if (prices.length === 0) return null;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const isUp = chartData[chartData.length - 1]?.price >= chartData[0]?.price;
  const color = isUp ? "#22C55E" : "#E53E3E";

  // ---------- Minimal sparkline (price only) ----------
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
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            fill={`url(#g-${symbol}-${days})`}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ---------- Volume bar chart ----------
  if (chartMode === "volume") {
    const volumes = chartData.map((d) => d.volume).filter(Boolean);
    const maxVol = volumes.length > 0 ? Math.max(...volumes) : 1;

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,174,192,0.06)" />
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#718096", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, maxVol * 1.1]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#718096", fontSize: 11 }}
            tickFormatter={(v: number) => formatVolume(v)}
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
            formatter={(value: number) => [formatVolume(value), "Volume"]}
          />
          <Bar dataKey="volume" radius={[2, 2, 0, 0]} maxBarSize={12}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.isUp ? "rgba(34,197,94,0.55)" : "rgba(229,62,62,0.55)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ---------- Price area chart (default) ----------
  const gradientId = isLive ? `gl-${symbol}` : `gf-${symbol}-${days}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          isAnimationActive={!isLive}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
