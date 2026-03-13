"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface Order {
  id: string;
  user_id: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  limit_price: number | null;
  stop_price: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useOrders() {
  const queryClient = useQueryClient();

  const query = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    staleTime: 10000,
  });

  return {
    ...query,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  };
}
