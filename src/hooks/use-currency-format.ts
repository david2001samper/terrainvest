"use client";

import { useProfile } from "@/hooks/use-profile";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency as formatCurrencyBase } from "@/lib/format";

const SUPPORTED_CURRENCIES = ["CAD", "USD", "EUR", "GBP", "AUD"] as const;

const DEFAULT_RATES: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.35, AUD: 1.53 };

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
};

function formatCompactWithCurrency(value: number | null | undefined, currency: string): string {
  const v = value ?? 0;
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";
  if (v >= 1_000_000_000_000) return `${sym}${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `${sym}${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(2)}K`;
  return `${sym}${v.toFixed(2)}`;
}

export function useCurrencyFormat() {
  const { data: profile } = useProfile();
  const { data: platformSettings } = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/platform/settings");
      if (!res.ok) return { currency_rates: DEFAULT_RATES };
      return res.json();
    },
    staleTime: 60000,
  });

  const rates = platformSettings?.currency_rates ?? DEFAULT_RATES;
  const currency = profile?.preferred_currency ?? "USD";
  const validCurrency = SUPPORTED_CURRENCIES.includes(currency as (typeof SUPPORTED_CURRENCIES)[number])
    ? currency
    : "USD";
  const rate = rates[validCurrency] ?? 1;
  const symbol = CURRENCY_SYMBOLS[validCurrency] ?? "$";

  const format = (value: number | null | undefined, decimals?: number) =>
    formatCurrencyBase((value ?? 0) * rate, decimals, validCurrency);

  const convert = (value: number | null | undefined) => (value ?? 0) * rate;

  const formatCompact = (value: number | null | undefined) =>
    formatCompactWithCurrency((value ?? 0) * rate, validCurrency);

  const pnlPrefix = (isPositive: boolean) => (isPositive ? `+${symbol}` : `-${symbol}`);

  return {
    format,
    convert,
    formatCompact,
    symbol,
    rate,
    currency: validCurrency,
    pnlPrefix,
  };
}

export { SUPPORTED_CURRENCIES };
