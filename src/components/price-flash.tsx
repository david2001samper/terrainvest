"use client";

import { usePriceFlash, flashClass } from "@/hooks/use-price-flash";

interface PriceFlashProps {
  value: number | null | undefined;
  children: React.ReactNode;
  className?: string;
}

export function PriceFlash({ value, children, className = "" }: PriceFlashProps) {
  const direction = usePriceFlash(value);

  return (
    <span className={`inline-block rounded px-1 -mx-1 transition-colors ${flashClass(direction)} ${className}`}>
      {children}
    </span>
  );
}
