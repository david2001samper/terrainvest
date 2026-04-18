"use client";

import { useEffect, useRef, useState } from "react";
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

async function fetchForex(): Promise<MarketAsset[]> {
  const res = await fetch("/api/market/forex");
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
      queryClient.invalidateQueries({ queryKey: ["market", "forex"] });
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

  const forex = useQuery<MarketAsset[]>({
    queryKey: ["market", "forex"],
    queryFn: fetchForex,
    refetchInterval: fast ? fastMs : 12000,
    staleTime: fast ? 1000 : 10000,
  });

  const allAssets = [...(crypto.data || []), ...(stocks.data || []), ...(forex.data || [])];
  const isLoading = crypto.isLoading || stocks.isLoading || forex.isLoading;

  return { allAssets, crypto, stocks, forex, isLoading };
}

export function useChartData(
  symbol: string,
  assetType: string,
  days = 30,
  interval = "1d",
  coingeckoId?: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: ["chart", symbol, assetType, days, interval, coingeckoId ?? ""],
    queryFn: async () => {
      const params = new URLSearchParams({
        symbol,
        type: assetType,
        days: days.toString(),
        interval,
      });
      if (coingeckoId) params.set("cg_id", coingeckoId);
      const res = await fetch(`/api/market/chart?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
    enabled: !!symbol && enabled,
  });
}

export interface LivePoint {
  time: string;
  price: number;
  volume: number;
}

/**
 * Accumulates live price+volume data points in a rolling buffer.
 * Volume is synthesised from price deltas: larger moves and downward moves
 * produce more volume, which naturally correlates with price simulations.
 */
export function useLiveChartData(
  price: number,
  baseVolume: number,
  dataUpdatedAt: number | undefined,
  enabled: boolean
): LivePoint[] {
  const [points, setPoints] = useState<LivePoint[]>([]);
  const prevPriceRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !dataUpdatedAt || price <= 0) return;
    if (dataUpdatedAt === lastUpdateRef.current) return;
    lastUpdateRef.current = dataUpdatedAt;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const prev = prevPriceRef.current;
    const changePct = prev > 0 ? Math.abs((price - prev) / prev) : 0;
    const isDown = prev > 0 && price < prev;

    // Base volume per tick ≈ 24h volume / ~4300 ticks (at ~20s avg polling)
    const basePerTick = Math.max(1, (baseVolume || 1e6) / 4320);
    // Bigger price moves → more volume; down moves get extra (selling pressure)
    const volatilityMul = 1 + changePct * 80 * (isDown ? 1.4 : 1.0);
    const randomFactor = 0.4 + Math.random() * 1.2;
    const tickVolume = Math.round(basePerTick * volatilityMul * randomFactor);

    prevPriceRef.current = price;

    const frame = window.requestAnimationFrame(() => {
      setPoints((prev) => {
        const updated = [...prev, { time: timeLabel, price, volume: tickVolume }];
        return updated.slice(-150); // ~12 min rolling window
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [price, baseVolume, dataUpdatedAt, enabled]);

  return points;
}

export function useMarketDataTimestamps() {
  const { crypto, stocks } = useMarketData();
  return {
    cryptoUpdatedAt: crypto.dataUpdatedAt,
    stocksUpdatedAt: stocks.dataUpdatedAt,
  };
}
