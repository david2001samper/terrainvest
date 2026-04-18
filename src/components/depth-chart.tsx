"use client";

import { useMemo } from "react";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Layers } from "lucide-react";
import type { OrderBookData } from "@/hooks/use-order-book";

interface DepthChartProps {
  data: OrderBookData | undefined;
  isLoading: boolean;
}

export function DepthChart({ data, isLoading }: DepthChartProps) {
  const { format: formatCurrency } = useCurrencyFormat();

  const chartData = useMemo(() => {
    if (!data) return [];

    const bidsCumulative: { price: number; bidVol: number; askVol: number }[] = [];
    let bidAccum = 0;
    const sortedBids = [...data.bids].sort((a, b) => b.price - a.price);
    for (const level of sortedBids) {
      bidAccum += level.size;
      bidsCumulative.push({
        price: level.price,
        bidVol: bidAccum,
        askVol: 0,
      });
    }
    bidsCumulative.reverse();

    const asksCumulative: { price: number; bidVol: number; askVol: number }[] = [];
    let askAccum = 0;
    const sortedAsks = [...data.asks].sort((a, b) => a.price - b.price);
    for (const level of sortedAsks) {
      askAccum += level.size;
      asksCumulative.push({
        price: level.price,
        bidVol: 0,
        askVol: askAccum,
      });
    }

    return [...bidsCumulative, ...asksCumulative];
  }, [data]);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00D4FF]" />
            Depth Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00D4FF]" />
            Depth Chart
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
            No depth data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const prices = chartData.map((d) => d.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#00D4FF]" />
          Depth Chart
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#22C55E" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E53E3E" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#E53E3E" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="price"
              type="number"
              domain={[minP, maxP]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 10 }}
              tickFormatter={(v: number) =>
                formatCurrency(v, v < 1 ? 4 : 2)
              }
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 10 }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: "#151822",
                border: "1px solid rgba(160,174,192,0.25)",
                borderRadius: "8px",
                color: "#E2E8F0",
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const safeValue = Number(value ?? 0);
                const label = name === "bidVol" ? "Bid Volume" : "Ask Volume";
                return [safeValue.toFixed(2), label];
              }}
              labelFormatter={(label) => {
                const safeLabel = Number(label ?? 0);
                return `Price: ${formatCurrency(safeLabel, safeLabel < 1 ? 6 : 2)}`;
              }}
            />
            {data.midPrice > 0 && (
              <ReferenceLine
                x={data.midPrice}
                stroke="#00D4FF"
                strokeDasharray="3 3"
                strokeOpacity={0.85}
              />
            )}
            <Area
              type="stepAfter"
              dataKey="bidVol"
              stroke="#22C55E"
              fill="url(#bidGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              type="stepAfter"
              dataKey="askVol"
              stroke="#E53E3E"
              fill="url(#askGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
