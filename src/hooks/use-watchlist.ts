"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WatchlistItem } from "@/lib/types";
import { toast } from "sonner";

export function useWatchlist() {
  const queryClient = useQueryClient();

  const query = useQuery<WatchlistItem[]>({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const toggle = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to update watchlist"
        );
      }
      return data as { action?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success(
        data.action === "added" ? "Added to watchlist" : "Removed from watchlist"
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update watchlist");
    },
  });

  const isWatched = (symbol: string) =>
    query.data?.some((w) => w.symbol === symbol) ?? false;

  return { ...query, toggle, isWatched };
}
