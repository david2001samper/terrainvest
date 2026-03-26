"use client";

import { useQuery } from "@tanstack/react-query";
import type { OptionsPosition } from "@/lib/types";

export function useOptionsPositions() {
  return useQuery<OptionsPosition[]>({
    queryKey: ["options-positions"],
    queryFn: async () => {
      const res = await fetch("/api/options/positions");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10000,
  });
}
