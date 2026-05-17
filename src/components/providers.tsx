"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { usePlatformBranding } from "@/hooks/use-platform-branding";

function BrandTheme() {
  const branding = usePlatformBranding();

  useEffect(() => {
    const root = document.documentElement;
    const primary = branding.primary_brand_color?.trim() || "#00D4FF";
    const secondary = branding.secondary_brand_color?.trim() || "#0EA5E9";

    root.style.setProperty("--brand-primary", primary);
    root.style.setProperty("--brand-secondary", secondary);
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--chart-1", primary);
    root.style.setProperty("--chart-3", secondary);
  }, [branding.primary_brand_color, branding.secondary_brand_color]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandTheme />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#151822",
              border: "1px solid rgba(160, 174, 192, 0.15)",
              color: "#E2E8F0",
              fontSize: "0.9375rem",
              padding: "14px 18px",
              minHeight: "3.25rem",
            },
          }}
          richColors
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
