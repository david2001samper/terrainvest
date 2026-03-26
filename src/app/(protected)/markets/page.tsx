"use client";

import { useState, useEffect, useCallback } from "react";
import { useMarketData } from "@/hooks/use-market-data";
import { useWatchlist } from "@/hooks/use-watchlist";
import { useProfile } from "@/hooks/use-profile";
import { formatPercent } from "@/lib/format";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Heart,
  TrendingUp,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import type { MarketAsset } from "@/lib/types";
import { marketCardPrimaryLabel, marketCardSecondaryLabel } from "@/lib/market-display";
import { AssetLogo } from "@/components/asset-logo";
import { PriceFlash } from "@/components/price-flash";
import { FileText } from "lucide-react";

const TABS = [
  { value: "all", label: "All" },
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stocks" },
  { value: "commodity", label: "Commodities" },
  { value: "index", label: "Indexes" },
  { value: "forex", label: "Forex" },
  { value: "options", label: "Options" },
];

export default function MarketsPage() {
  const { format: formatCurrency, formatCompact } = useCurrencyFormat();
  const { allAssets, isLoading } = useMarketData();
  const { isWatched, toggle } = useWatchlist();
  const { data: profile } = useProfile();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [searchResults, setSearchResults] = useState<MarketAsset[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search, doSearch]);

  const isOptionsTab = activeTab === "options";

  const hasTabPermission = (tab: string): boolean => {
    if (!profile) return true;
    const map: Record<string, keyof typeof profile> = {
      crypto: "can_trade_crypto",
      stock: "can_trade_stocks",
      commodity: "can_trade_commodities",
      index: "can_trade_indexes",
      forex: "can_trade_forex",
      options: "can_trade_options",
    };
    const field = map[tab];
    if (!field) return true;
    return profile[field] !== false;
  };

  const isBlockedTab = activeTab !== "all" && !hasTabPermission(activeTab);

  const localFiltered = allAssets
    .filter((a) => {
      if (isOptionsTab) return a.asset_type === "stock";
      return activeTab === "all" || a.asset_type === activeTab;
    })
    .filter(
      (a) =>
        !search ||
        a.symbol.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase())
    );

  const isSearchMode = search.length >= 2;

  const mergedResults = isSearchMode
    ? deduplicateAssets([...localFiltered, ...searchResults])
    : localFiltered;

  const displayAssets = isBlockedTab
    ? []
    : mergedResults.filter((a) => {
        if (isOptionsTab) return a.asset_type === "stock";
        return activeTab === "all" || a.asset_type === activeTab;
      });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#00D4FF]" />
          Markets
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live prices across global markets — search for any crypto, stock, commodity, or index
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search any asset (e.g. Bitcoin, AAPL, Gold)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background/50 border-border focus:border-[#00D4FF] h-10"
            disabled={isBlockedTab}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00D4FF] animate-spin" />
          )}
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v ?? "all")}>
          <TabsList className="bg-background/50">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs data-[state=active]:bg-[#00D4FF]/10 data-[state=active]:text-[#00D4FF]"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isSearchMode && (
        <p className="text-xs text-muted-foreground">
          {searching
            ? "Searching global markets..."
            : `Found ${displayAssets.length} result${displayAssets.length !== 1 ? "s" : ""} for "${search}"`}
        </p>
      )}

      {isBlockedTab ? (
        <Card className="glass-card">
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#00D4FF]/10 flex items-center justify-center border border-[#00D4FF]/20">
                <ShieldAlert className="w-6 h-6 text-[#00D4FF]" />
              </div>
              <h3 className="text-lg font-semibold">Permission Required</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                You do not have permission to access{" "}
                <span className="text-foreground font-medium">
                  {TABS.find((t) => t.value === activeTab)?.label ?? activeTab}
                </span>
                . Contact your account manager to enable it.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading && !isSearchMode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : displayAssets.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">
              {isSearchMode
                ? `No results for "${search}". Try a different term.`
                : "No assets found in this category."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayAssets.map((asset) => (
            <AssetCard
              key={asset.symbol}
              asset={asset}
              isWatched={isWatched(asset.symbol)}
              onToggleWatch={() => toggle.mutate(asset.symbol)}
              formatCurrency={formatCurrency}
              formatCompact={formatCompact}
              optionsMode={isOptionsTab}
              iconFetchMode={isSearchMode ? "eager" : "lazy"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function deduplicateAssets(assets: MarketAsset[]): MarketAsset[] {
  const seen = new Map<string, MarketAsset>();
  for (const asset of assets) {
    const existing = seen.get(asset.symbol);
    if (!existing || (asset.price > 0 && existing.price === 0)) {
      seen.set(asset.symbol, asset);
    }
  }
  return Array.from(seen.values());
}

function AssetCard({
  asset,
  isWatched,
  onToggleWatch,
  formatCurrency,
  formatCompact,
  optionsMode,
  iconFetchMode,
}: {
  asset: MarketAsset;
  isWatched: boolean;
  onToggleWatch: () => void;
  formatCurrency: (value: number | null | undefined, decimals?: number) => string;
  formatCompact: (value: number | null | undefined) => string;
  optionsMode?: boolean;
  iconFetchMode?: "lazy" | "eager";
}) {
  const isUp = (asset.changePercent24h ?? 0) >= 0;
  const cardTitle = marketCardPrimaryLabel(asset);
  const cardSubtitle = marketCardSecondaryLabel(asset);

  return (
    <Card className="glass-card-hover group relative">
      <Link
        href={
          optionsMode
            ? `/markets/${encodeURIComponent(asset.symbol)}/options`
            : `/markets/${encodeURIComponent(asset.symbol)}?type=${asset.asset_type}${
                asset.coingecko_id ? `&cg=${encodeURIComponent(asset.coingecko_id)}` : ""
              }`
        }
        className="absolute inset-0 z-10"
      />
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <AssetLogo
            symbol={asset.symbol}
            assetType={asset.asset_type}
            coingeckoId={asset.coingecko_id}
            fetchMode={iconFetchMode ?? "lazy"}
            size={36}
            className="relative z-0"
          />
          <div className="min-w-0">
            <CardTitle className="text-base font-bold group-hover:text-[#00D4FF] transition-colors">
              {cardTitle}
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate">{cardSubtitle}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWatch();
          }}
          className="relative z-20 p-1 hover:scale-110 transition-transform"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isWatched ? "fill-[#00D4FF] text-[#00D4FF]" : "text-muted-foreground hover:text-[#00D4FF]"
            }`}
          />
        </button>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <PriceFlash value={asset.price}>
              <p className="text-xl font-bold">
                {formatCurrency(asset.price, (asset.price ?? 0) < 1 ? 6 : 2)}
              </p>
            </PriceFlash>
            <div
              className={`flex items-center gap-1 text-sm font-medium mt-1 ${
                isUp ? "text-green-400" : "text-red-400"
              }`}
            >
              {isUp ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {formatPercent(asset.changePercent24h)}
            </div>
          </div>
          <div className="text-right space-y-0.5">
            {optionsMode && (
              <p className="text-[11px] text-[#00D4FF] flex items-center gap-1 justify-end">
                <FileText className="w-3 h-3" /> Options
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Vol: {formatCompact(asset.volume)}
            </p>
            {(asset.marketCap ?? 0) > 0 && (
              <p className="text-[11px] text-muted-foreground">
                MCap: {formatCompact(asset.marketCap)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
