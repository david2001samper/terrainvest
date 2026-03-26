import type { SnapshotAsset } from "@/lib/market-snapshot";
import { formatCurrency, formatPercent } from "@/lib/format";
import { stripYahooInstrumentSuffixes } from "@/lib/market-display";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const DISPLAY_NAMES: Record<string, string> = {
  BTC: "BTC/USD",
  ETH: "ETH/USD",
  "GC=F": "Gold XAU/USD",
  "CL=F": "Crude Oil",
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
};

const LOGO_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  AAPL: "#555555",
  TSLA: "#CC0000",
  NVDA: "#76B900",
  AMZN: "#FF9900",
  "GC=F": "#CFB53B",
  "CL=F": "#4A4A4A",
  "^GSPC": "#3B82F6",
  "^IXIC": "#8B5CF6",
};

const LOGO_TEXT: Record<string, string> = {
  BTC: "BTC",
  ETH: "ETH",
  AAPL: "AAPL",
  TSLA: "TSLA",
  NVDA: "NVDA",
  AMZN: "AMZN",
  "GC=F": "Au",
  "CL=F": "Oil",
  "^GSPC": "SPX",
  "^IXIC": "NDQ",
};

interface MarketSnapshotGridProps {
  assets: SnapshotAsset[];
}

export function MarketSnapshotGrid({ assets }: MarketSnapshotGridProps) {
  if (assets.length === 0) return null;

  return (
    <section className="relative z-10 px-6 lg:px-12 py-16 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-center">Live Market Prices</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {assets.map((asset) => {
          const isUp = (asset.changePercent24h ?? 0) >= 0;
          const displaySymbol =
            DISPLAY_NAMES[asset.symbol] ?? stripYahooInstrumentSuffixes(asset.symbol);
          const color = LOGO_COLORS[asset.symbol] ?? "#00D4FF";
          const text =
            LOGO_TEXT[asset.symbol] ??
            stripYahooInstrumentSuffixes(asset.symbol).replace(/[^A-Z]/g, "").slice(0, 3);
          return (
            <div
              key={asset.symbol}
              className="glass-card-hover p-4 rounded-xl flex items-center gap-3"
            >
              <div
                className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  fontSize: 11,
                  background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                }}
              >
                {text}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {displaySymbol}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {formatCurrency(asset.price, asset.price < 1 ? 4 : 2)}
                </p>
                <span
                  className={`text-xs font-semibold flex items-center gap-0.5 ${
                    isUp ? "text-green-400" : "text-[#E53E3E]"
                  }`}
                >
                  {isUp ? (
                    <ArrowUpRight className="w-3 h-3 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 shrink-0" />
                  )}
                  {formatPercent(asset.changePercent24h)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
