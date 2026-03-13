"use client";

const TIMEFRAMES = [
  { label: "1D", value: "1d", days: 1, interval: "5m" },
  { label: "5D", value: "5d", days: 5, interval: "15m" },
  { label: "1W", value: "1w", days: 7, interval: "30m" },
  { label: "1M", value: "1m", days: 30, interval: "1d" },
  { label: "3M", value: "3m", days: 90, interval: "1d" },
  { label: "6M", value: "6m", days: 180, interval: "1wk" },
  { label: "1Y", value: "1y", days: 365, interval: "1wk" },
  { label: "All", value: "all", days: 1825, interval: "1mo" },
] as const;

export type TimeframeValue = (typeof TIMEFRAMES)[number]["value"];

interface TimeframeSelectorProps {
  value: TimeframeValue;
  onChange: (tf: TimeframeValue) => void;
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-background/60 border border-border">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            value === tf.value
              ? "bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/25"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-transparent"
          }`}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}

export function getTimeframeConfig(value: TimeframeValue) {
  return TIMEFRAMES.find((tf) => tf.value === value) || TIMEFRAMES[3];
}

export { TIMEFRAMES };
