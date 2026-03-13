"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

const ASSET_COLORS: Record<string, string> = {
  crypto: "#00D4FF",
  stock: "#0EA5E9",
  commodity: "#F59E0B",
  index: "#8B5CF6",
};

interface AllocationItem {
  name: string;
  value: number;
  type: string;
}

interface AssetAllocationChartProps {
  positions: { symbol: string; currentValue: number; assetType: string }[];
  cashBalance?: number;
  viewMode?: "asset_class" | "holdings";
  currency?: string;
  /** Converts USD value to display value and formats. If not provided, uses formatCurrency from lib. */
  formatValue?: (value: number) => string;
}

export function AssetAllocationChart({
  positions,
  cashBalance = 0,
  viewMode = "asset_class",
  currency = "USD",
  formatValue,
}: AssetAllocationChartProps) {
  const data = useMemo(() => {
    if (viewMode === "asset_class") {
      const byType: Record<string, number> = { crypto: 0, stock: 0, commodity: 0, index: 0 };
      positions.forEach((p) => {
        const t = p.assetType || "stock";
        byType[t] = (byType[t] ?? 0) + p.currentValue;
      });
      const items: AllocationItem[] = [];
      if (cashBalance > 0) {
        items.push({ name: "Cash", value: cashBalance, type: "cash" });
      }
      Object.entries(byType).forEach(([type, value]) => {
        if (value > 0) {
          items.push({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            value,
            type,
          });
        }
      });
      return items;
    }
    const items: AllocationItem[] = positions.map((p) => ({
      name: p.symbol,
      value: p.currentValue,
      type: p.assetType || "stock",
    }));
    if (cashBalance > 0) {
      items.unshift({ name: "Cash", value: cashBalance, type: "cash" });
    }
    return items;
  }, [positions, cashBalance, viewMode]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
        No allocation data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {data.map((entry, i) => (
            <Cell
              key={entry.name}
              fill={entry.type === "cash" ? "#64748B" : ASSET_COLORS[entry.type] ?? "#00D4FF"}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => {
            const v = typeof value === "number" ? value : parseFloat(String(value ?? 0)) || 0;
            return formatValue ? formatValue(v) : formatCurrency(v, 2, currency);
          }}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
