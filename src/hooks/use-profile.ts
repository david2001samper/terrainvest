"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { useEffect } from "react";

export function useProfile() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery<Profile | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load profile");
      return (await res.json()) as Profile;
    },
    staleTime: 30000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["profile"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  return query;
}
