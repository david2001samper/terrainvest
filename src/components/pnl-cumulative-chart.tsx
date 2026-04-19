"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface CumulativePnlPoint {
  date: string;
  cumulative: number;
}

interface PnlCumulativeChartProps {
  data: CumulativePnlPoint[];
  chartColor: string;
  formatCurrency: (n: number) => string;
}

/**
 * Recharts area chart for cumulative P&L. Lives in its own file so the
 * heavyweight recharts bundle can be code-split via next/dynamic and
 * loaded only when the user opens the P&L tab.
 */
export default function PnlCumulativeChart({
  data,
  chartColor,
  formatCurrency,
}: PnlCumulativeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColor} stopOpacity={0.38} />
            <stop offset="95%" stopColor={chartColor} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(160,174,192,0.12)"
        />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#94A3B8", fontSize: 11 }}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#94A3B8", fontSize: 11 }}
          tickFormatter={(v: number) =>
            `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`
          }
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: "#151822",
            border: "1px solid rgba(160,174,192,0.25)",
            borderRadius: "8px",
            color: "#E2E8F0",
            fontSize: 13,
          }}
          formatter={(value) => [
            formatCurrency(Number(value ?? 0)),
            "Cumulative P&L",
          ]}
          labelFormatter={(label) =>
            new Date(String(label ?? "")).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          }
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={chartColor}
          fill="url(#pnlGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
