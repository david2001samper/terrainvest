"use client";

import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/lib/types";

export function useProfile() {
  return useQuery<Profile | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load profile");
      return (await res.json()) as Profile;
    },
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}
