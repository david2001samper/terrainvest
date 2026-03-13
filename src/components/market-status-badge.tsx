"use client";

import { Badge } from "@/components/ui/badge";

interface MarketStatusBadgeProps {
  assetType: string;
  marketState?: string | null;
}

export function MarketStatusBadge({ assetType, marketState }: MarketStatusBadgeProps) {
  if (assetType === "crypto") {
    return (
      <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/25 font-medium">
        24/7 Market
      </Badge>
    );
  }

  const state = (marketState || "").toUpperCase();

  if (state === "REGULAR" || state === "OPEN") {
    return (
      <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/25 font-medium">
        Market Open
      </Badge>
    );
  }

  if (state === "PRE") {
    return (
      <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/25 font-medium">
        Pre-Market
      </Badge>
    );
  }

  if (state === "POST" || state === "POSTPOST") {
    return (
      <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/25 font-medium">
        After-Hours
      </Badge>
    );
  }

  return (
    <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/25 font-medium">
      Market Closed
    </Badge>
  );
}
