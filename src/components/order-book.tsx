"use client";

import { useMemo } from "react";
import { useOrderBook, type OrderBookLevel } from "@/hooks/use-order-book";
import { useProfile } from "@/hooks/use-profile";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Lock } from "lucide-react";

interface OrderBookProps {
  symbol: string;
  assetType: string;
}

function DepthRow({
  level,
  maxSize,
  side,
  formatPrice,
  formatSize,
}: {
  level: OrderBookLevel;
  maxSize: number;
  side: "bid" | "ask";
  formatPrice: (v: number) => string;
  formatSize: (v: number) => string;
}) {
  const pct = maxSize > 0 ? (level.size / maxSize) * 100 : 0;
  const barColor =
    side === "bid" ? "rgba(34,197,94,0.28)" : "rgba(229,62,62,0.28)";
  const textColor =
    side === "bid" ? "text-green-400" : "text-red-400";

  return (
    <div className="relative flex items-center text-xs h-7 px-2">
      <div
        className="absolute inset-y-0 rounded-sm"
        style={{
          width: `${pct}%`,
          backgroundColor: barColor,
          ...(side === "bid" ? { right: 0 } : { left: 0 }),
        }}
      />
      <span
        className={`relative z-10 font-mono font-medium ${textColor} ${
          side === "bid" ? "mr-auto" : "ml-auto"
        }`}
      >
        {formatPrice(level.price)}
      </span>
      <span className="relative z-10 font-mono text-foreground/70 ml-4">
        {formatSize(level.size)}
      </span>
    </div>
  );
}

export function OrderBook({ symbol, assetType }: OrderBookProps) {
  const { data: profile } = useProfile();
  const { format: formatCurrency } = useCurrencyFormat();
  const canView = profile?.can_view_order_book ?? false;

  const { data, isLoading, isError } = useOrderBook(
    symbol,
    assetType,
    canView
  );

  const maxSize = useMemo(() => {
    if (!data) return 0;
    const allSizes = [
      ...data.bids.map((l) => l.size),
      ...data.asks.map((l) => l.size),
    ];
    return Math.max(...allSizes, 1);
  }, [data]);

  const formatPrice = (v: number) =>
    formatCurrency(v, v < 1 ? 6 : v < 100 ? 4 : 2);

  const formatSize = (v: number) => {
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(v < 1 ? 4 : 2);
  };

  if (!canView) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00D4FF]/10 flex items-center justify-center border border-[#00D4FF]/20">
              <Lock className="w-5 h-5 text-[#00D4FF]" />
            </div>
            <p className="text-sm font-medium">Order Book</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Level 2 market depth is not enabled on your account. Contact your
              account manager to unlock this feature.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#00D4FF]" />
            Order Book
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#00D4FF]" />
            Order Book
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Order book data unavailable for this asset
          </p>
        </CardContent>
      </Card>
    );
  }

  const bids = data.bids.slice(0, 10);
  const asks = data.asks.slice(0, 10);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#00D4FF]" />
            Order Book
          </CardTitle>
          <span className="text-xs text-foreground/65 uppercase tracking-wide">
            Spread: {formatPrice(data.spread)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 text-[10px] uppercase text-muted-foreground px-2 pb-1 border-b border-border">
          <div className="flex justify-between px-2">
            <span>Bid Price</span>
            <span>Size</span>
          </div>
          <div className="flex justify-between px-2">
            <span>Ask Price</span>
            <span>Size</span>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="py-1">
            {bids.map((level, i) => (
              <DepthRow
                key={i}
                level={level}
                maxSize={maxSize}
                side="bid"
                formatPrice={formatPrice}
                formatSize={formatSize}
              />
            ))}
          </div>
          <div className="py-1">
            {asks.map((level, i) => (
              <DepthRow
                key={i}
                level={level}
                maxSize={maxSize}
                side="ask"
                formatPrice={formatPrice}
                formatSize={formatSize}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
