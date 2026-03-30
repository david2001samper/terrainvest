"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";

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
