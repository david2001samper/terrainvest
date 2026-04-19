/**
 * Next.js instrumentation hook — runs once per Node process at boot.
 *
 * We use it to "warm" the modules that almost every request touches, so the
 * first user after a `pm2 restart` doesn't pay the lazy-import cost (which
 * for things like yahoo-finance2 + the supabase service client can be
 * several hundred ms).
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run server-side and only in production. Dev mode does its own
  // module compilation per request, so warming would just slow startup.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  // Fire-and-forget: don't block boot if any of these fail (offline build, etc.)
  Promise.allSettled([
    // Supabase server client — used by every API route
    import("@/lib/supabase/server"),
    // Market price helpers — touched by orders/processor on first poll
    import("@/lib/market-price"),
    // Price simulator state — used as soon as any override exists
    import("@/lib/price-simulator"),
    import("@/lib/price-overrides"),
    // Order processor — runs on every GET /api/orders
    import("@/lib/orders/processor"),
  ]).catch(() => {
    // Warm-up failures are non-fatal; they'll just be lazy-loaded later.
  });
}
