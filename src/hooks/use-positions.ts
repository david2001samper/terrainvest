"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useIsTabVisible } from "@/hooks/use-is-tab-visible";
import type { Position, Trade } from "@/lib/types";
import { useEffect } from "react";

export function usePositions() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const visible = useIsTabVisible();

  const query = useQuery<Position[]>({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      return (data as Position[]) || [];
    },
    refetchInterval: visible ? 10000 : false,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel("position-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "positions" },
        () => queryClient.invalidateQueries({ queryKey: ["positions"] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, queryClient]);

  return query;
}

export function useTrades(limit = 50) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery<Trade[]>({
    queryKey: ["trades", limit],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data as Trade[]) || [];
    },
    // Trades are also pushed via realtime subscription (below), so a long
    // staleTime is safe — we don't need polling on top.
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel("trade-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trades" },
        () => queryClient.invalidateQueries({ queryKey: ["trades"] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, queryClient]);

  return query;
}
