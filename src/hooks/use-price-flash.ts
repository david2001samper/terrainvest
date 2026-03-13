"use client";

import { useEffect, useRef, useState } from "react";

export type FlashDirection = "up" | "down" | null;

export function usePriceFlash(value: number | null | undefined): FlashDirection {
  const prevRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<FlashDirection>(null);

  useEffect(() => {
    const current = value ?? 0;
    const prev = prevRef.current;

    if (prev !== null && prev !== current) {
      setFlash(current > prev ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(timer);
    }

    prevRef.current = current;
  }, [value]);

  return flash;
}

export function flashClass(direction: FlashDirection): string {
  if (direction === "up") return "flash-up";
  if (direction === "down") return "flash-down";
  return "";
}
