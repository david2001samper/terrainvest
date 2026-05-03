"use client";

import { useState } from "react";

type MarketAssetLogoProps = {
  logoUrl?: string | null;
  fallbackText: string;
  fallbackBg: string;
};

export function MarketAssetLogo({ logoUrl, fallbackText, fallbackBg }: MarketAssetLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-bold text-white shrink-0 text-[11px]"
        style={{
          width: 36,
          height: 36,
          background: `linear-gradient(135deg, ${fallbackBg}, ${fallbackBg}cc)`,
        }}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote CDN logos; onError fallback above
    <img
      src={logoUrl}
      alt=""
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="rounded-full object-cover bg-muted shrink-0 ring-1 ring-border size-9"
      onError={() => setFailed(true)}
    />
  );
}
