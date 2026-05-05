import { NextResponse, type NextRequest } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, number[]>();

export function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
  recent.push(now);
  buckets.set(key, recent);

  return {
    limited: recent.length > limit,
    remaining: Math.max(0, limit - recent.length),
    resetInMs: windowMs - (now - recent[0]),
  };
}

export function rateLimitResponse(resetInMs: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(resetInMs / 1000))),
      },
    }
  );
}
