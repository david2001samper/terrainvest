"use client";

import { useEffect, useRef, useMemo } from "react";
import { useChartData } from "@/hooks/use-market-data";
import { Skeleton } from "@/components/ui/skeleton";

interface CandlestickChartProps {
  symbol: string;
  assetType: string;
  height?: number;
  days?: number;
  interval?: string;
  coingeckoId?: string | null;
}

interface OHLCPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function CandlestickChart({
  symbol,
  assetType,
  height = 400,
  days = 30,
  interval = "1d",
  coingeckoId,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<
    typeof import("lightweight-charts").createChart
  > | null>(null);

  const { data: rawData, isLoading } = useChartData(
    symbol,
    assetType,
    days,
    interval,
    coingeckoId,
    true
  );

  const candleData = useMemo(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];
    return (rawData as OHLCPoint[])
      .filter((d) => d.close > 0 && d.open > 0)
      .map((d) => ({
        time: (new Date(d.time).getTime() / 1000) as import("lightweight-charts").UTCTimestamp,
        open: d.open,
        high: d.high || Math.max(d.open, d.close),
        low: d.low || Math.min(d.open, d.close),
        close: d.close,
      }));
  }, [rawData]);

  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current || candleData.length === 0) return;

    let disposed = false;

    (async () => {
      const { createChart, CandlestickSeries } = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { color: "transparent" },
          textColor: "#94A3B8",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(160,174,192,0.12)" },
          horzLines: { color: "rgba(160,174,192,0.12)" },
        },
        crosshair: {
          vertLine: { color: "rgba(0,212,255,0.5)", labelBackgroundColor: "#00D4FF" },
          horzLine: { color: "rgba(0,212,255,0.5)", labelBackgroundColor: "#00D4FF" },
        },
        rightPriceScale: {
          borderColor: "rgba(160,174,192,0.2)",
        },
        timeScale: {
          borderColor: "rgba(160,174,192,0.2)",
          timeVisible: days <= 7,
          secondsVisible: false,
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#E53E3E",
        wickUpColor: "#22C55E",
        wickDownColor: "#E53E3E",
        borderVisible: false,
      });

      series.setData(candleData);
      chart.timeScale().fitContent();
      chartRef.current = chart;

      const observer = new ResizeObserver((entries) => {
        if (disposed) return;
        for (const entry of entries) {
          chart.applyOptions({ width: entry.contentRect.width });
        }
      });
      observer.observe(containerRef.current);
      observerRef.current = observer;
    })();

    return () => {
      disposed = true;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candleData, height, days]);

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  if (!rawData || (Array.isArray(rawData) && rawData.length === 0) || candleData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No chart data available
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} />;
}
