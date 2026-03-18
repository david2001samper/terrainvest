"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MarketAsset } from "@/lib/types";

interface OverrideStatus {
  active: boolean;
  symbols: string[];
  refresh_ms: number | null;
}

async function fetchOverrideStatus(): Promise<OverrideStatus> {
  try {
    const res = await fetch("/api/market/override-status");
    if (!res.ok) return { active: false, symbols: [], refresh_ms: null };
    return res.json();
  } catch {
    return { active: false, symbols: [], refresh_ms: null };
  }
}

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
  const queryClient = useQueryClient();
  const wasActiveRef = useRef(false);

  const overrideStatus = useQuery<OverrideStatus>({
    queryKey: ["market", "override-status"],
    queryFn: fetchOverrideStatus,
    refetchInterval: 3000,
    staleTime: 2000,
  });

  const fast = overrideStatus.data?.active === true;
  const fastMs = overrideStatus.data?.refresh_ms ?? 2000;

  useEffect(() => {
    if (wasActiveRef.current && !fast) {
      queryClient.invalidateQueries({ queryKey: ["market", "crypto"] });
      queryClient.invalidateQueries({ queryKey: ["market", "stocks"] });
    }
    wasActiveRef.current = fast;
  }, [fast, queryClient]);

  const crypto = useQuery<MarketAsset[]>({
    queryKey: ["market", "crypto"],
    queryFn: fetchCrypto,
    refetchInterval: fast ? fastMs : 8000,
    staleTime: fast ? 1000 : 6000,
  });

  const stocks = useQuery<MarketAsset[]>({
    queryKey: ["market", "stocks"],
    queryFn: fetchStocks,
    refetchInterval: fast ? fastMs : 10000,
    staleTime: fast ? 1000 : 8000,
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
