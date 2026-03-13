"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface LastUpdatedProps {
  dataUpdatedAt: number | undefined;
  className?: string;
}

export function LastUpdated({ dataUpdatedAt, className = "" }: LastUpdatedProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!dataUpdatedAt) return null;

  const seconds = Math.max(0, Math.floor((now - dataUpdatedAt) / 1000));
  const text = seconds < 5 ? "Just now" : `${seconds}s ago`;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] text-muted-foreground ${className}`}>
      <Clock className="w-3 h-3" />
      {text}
    </span>
  );
}
