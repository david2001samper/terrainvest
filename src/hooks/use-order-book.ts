"use client";

import { useQuery } from "@tanstack/react-query";

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  midPrice: number;
  spread: number;
  source: string;
}

export function useOrderBook(
  symbol: string,
  assetType: string,
  enabled = true,
  refetchIntervalMs = 8 * 1000
) {
  return useQuery<OrderBookData>({
    queryKey: ["orderbook", symbol, assetType],
    queryFn: async () => {
      const params = new URLSearchParams({ symbol, type: assetType });
      const res = await fetch(`/api/market/orderbook?${params}`);
      if (!res.ok) throw new Error("Order book unavailable");
      return res.json();
    },
    enabled: !!symbol && enabled,
    refetchInterval: refetchIntervalMs,
    staleTime: Math.max(0, refetchIntervalMs - 2_000),
  });
}
