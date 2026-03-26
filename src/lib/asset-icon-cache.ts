const PREFIX = "terra:asset-icon:v1:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY = 12;

let pruneCounter = 0;

export function assetIconCacheKey(coingeckoId: string): string {
  return `${PREFIX}${coingeckoId}`;
}

export function getCachedAssetIconUrl(coingeckoId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(assetIconCacheKey(coingeckoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { u?: string; t?: number };
    if (!parsed.u || typeof parsed.t !== "number") return null;
    if (Date.now() - parsed.t > TTL_MS) {
      localStorage.removeItem(assetIconCacheKey(coingeckoId));
      return null;
    }
    return parsed.u;
  } catch {
    return null;
  }
}

export function setCachedAssetIconUrl(coingeckoId: string, url: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      assetIconCacheKey(coingeckoId),
      JSON.stringify({ u: url, t: Date.now() })
    );
    pruneCounter += 1;
    if (pruneCounter >= PRUNE_EVERY) {
      pruneCounter = 0;
      pruneExpiredAssetIconEntries();
    }
  } catch {
    /* quota / private mode */
  }
}

function pruneExpiredAssetIconEntries(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    const now = Date.now();
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { t?: number };
        if (typeof parsed.t !== "number" || now - parsed.t > TTL_MS) {
          localStorage.removeItem(k);
        }
      } catch {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}
