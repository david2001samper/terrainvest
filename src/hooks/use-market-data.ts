"use client";

import { useQuery } from "@tanstack/react-query";
import type { MarketAsset } from "@/lib/types";

async function fetchCrypto(): Promise<MarketAsset[]> {
  const res = await fetch("/api/market/crypto");
  if (!res.ok) return [];
  return res.json();
}

async function fetchStocks(): Promise<MarketAsset[]> {
  const res = await fetch("/api/market/stocks");
  if (!res.ok) return [];
  return res.json();
}

export function useMarketData() {
  const crypto = useQuery<MarketAsset[]>({
    queryKey: ["market", "crypto"],
    queryFn: fetchCrypto,
    refetchInterval: 8000,
    staleTime: 6000,
  });

  const stocks = useQuery<MarketAsset[]>({
    queryKey: ["market", "stocks"],
    queryFn: fetchStocks,
    refetchInterval: 10000,
    staleTime: 8000,
  });

  const allAssets = [...(crypto.data || []), ...(stocks.data || [])];
  const isLoading = crypto.isLoading || stocks.isLoading;

  return { allAssets, crypto, stocks, isLoading };
}

export function useChartData(
  symbol: string,
  assetType: string,
  days = 30,
  interval = "1d"
) {
  return useQuery({
    queryKey: ["chart", symbol, assetType, days, interval],
    queryFn: async () => {
      const params = new URLSearchParams({
        symbol,
        type: assetType,
        days: days.toString(),
        interval,
      });
      const res = await fetch(`/api/market/chart?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
    enabled: !!symbol,
  });
}

export function useMarketDataTimestamps() {
  const { crypto, stocks } = useMarketData();
  return {
    cryptoUpdatedAt: crypto.dataUpdatedAt,
    stocksUpdatedAt: stocks.dataUpdatedAt,
  };
}
