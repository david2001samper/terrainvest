import { useQuery } from "@tanstack/react-query";
import { BRANDING_DEFAULTS, type PlatformBranding } from "@/lib/platform-config";

export function usePlatformBranding(): PlatformBranding {
  const { data } = useQuery<PlatformBranding>({
    queryKey: ["platform-branding"],
    queryFn: async () => {
      const res = await fetch("/api/platform/branding");
      if (!res.ok) return { ...BRANDING_DEFAULTS };
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
  return data ?? { ...BRANDING_DEFAULTS };
}
