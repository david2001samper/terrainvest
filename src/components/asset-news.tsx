"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Newspaper } from "lucide-react";

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

interface AssetNewsProps {
  symbol: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AssetNews({ symbol }: AssetNewsProps) {
  const { data, isLoading } = useQuery<NewsItem[]>({
    queryKey: ["news", symbol],
    queryFn: async () => {
      const res = await fetch(
        `/api/market/news?symbol=${encodeURIComponent(symbol)}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!symbol,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Newspaper className="w-8 h-8 text-muted-foreground opacity-60" />
        <p className="text-sm">No recent news for {symbol}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
      {data.map((item, i) => (
        <a
          key={i}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-3 rounded-lg border border-border bg-background/40 hover:bg-accent/30 hover:border-[#00D4FF]/30 transition-all group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-2 group-hover:text-[#00D4FF] transition-colors">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-foreground/65">
                  {item.publisher}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo(item.publishedAt)}
                </span>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-[#00D4FF] transition-colors" />
          </div>
        </a>
      ))}
    </div>
  );
}
