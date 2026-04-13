"use client";

interface GreeksProps {
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
}

export function OptionsGreeks({ delta, gamma, theta, vega }: GreeksProps) {
  const items = [
    { label: "Δ", value: delta, decimals: 4 },
    { label: "Γ", value: gamma, decimals: 4 },
    { label: "Θ", value: theta, decimals: 4 },
    { label: "ν", value: vega, decimals: 4 },
  ];

  const hasAny = items.some((g) => g.value != null);
  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((g) =>
        g.value != null ? (
          <span
            key={g.label}
            className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/60 border border-border text-muted-foreground"
          >
            <span className="text-[#00D4FF] font-medium">{g.label}</span>
            {g.value.toFixed(g.decimals)}
          </span>
        ) : null
      )}
    </div>
  );
}
