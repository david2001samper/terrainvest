"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
  ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot", AVAX: "avalanche-2",
  MATIC: "matic-network", LINK: "chainlink", BNB: "binancecoin",
  SHIB: "shiba-inu", UNI: "uniswap", ATOM: "cosmos", FTM: "fantom",
  NEAR: "near", APT: "aptos", ARB: "arbitrum", OP: "optimism",
  LTC: "litecoin", BCH: "bitcoin-cash", TRX: "tron", ALGO: "algorand",
};

const STOCK_COLORS: Record<string, string> = {
  AAPL: "#555555", TSLA: "#CC0000", NVDA: "#76B900", AMZN: "#FF9900",
  GOOGL: "#4285F4", MSFT: "#00A4EF", META: "#1877F2", NFLX: "#E50914",
  AMD: "#ED1C24", JPM: "#003A70",
};

interface AssetLogoProps {
  symbol: string;
  assetType: string;
  size?: number;
  className?: string;
}

export function AssetLogo({ symbol, assetType, size = 40, className = "" }: AssetLogoProps) {
  const [imgError, setImgError] = useState(false);

  const cgId = COINGECKO_IDS[symbol];
  const { data: logoUrl } = useQuery<string | null>({
    queryKey: ["logo", symbol],
    queryFn: async () => {
      if (assetType === "crypto" && cgId) {
        try {
          const res = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
          if (res.ok) {
            const data = await res.json();
            return data.image?.small || data.image?.large || null;
          }
        } catch { /* fallback */ }
      }
      return null;
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: assetType === "crypto" && !!cgId,
  });

  if (logoUrl && !imgError) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  const color = STOCK_COLORS[symbol] || symbolColor(symbol);
  const label = symbol.replace(/[^A-Z]/g, "").slice(0, 3) || symbol.slice(0, 2);
  const iconMap: Record<string, string> = {
    "GC=F": "Au", "SI=F": "Ag", "CL=F": "Oil", "NG=F": "Gas", "PL=F": "Pt",
    "^GSPC": "SPX", "^IXIC": "NDQ", "^DJI": "DJI", "^RUT": "RUT",
  };
  const text = iconMap[symbol] || label;

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.3,
        background: `linear-gradient(135deg, ${color}, ${adjustBrightness(color, -30)})`,
      }}
    >
      {text}
    </div>
  );
}

function symbolColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

function adjustBrightness(hex: string, amount: number): string {
  if (hex.startsWith("hsl")) return hex;
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
