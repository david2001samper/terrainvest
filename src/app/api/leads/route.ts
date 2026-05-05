import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const leadSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Invalid email address").max(254),
  phone: z.string().trim().max(40).optional().nullable(),
  country_code: z.string().trim().max(8).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  investment_range: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
});

function allowedOrigins() {
  return new Set(
    [
      process.env.NEXT_PUBLIC_SITE_URL,
      ...(process.env.LEADS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ].filter(Boolean)
  );
}

function corsHeaders(origin: string | null) {
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };
  if (origin && allowed.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function isAllowedCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin || allowedOrigins().has(origin);
}

function responseHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin === request.nextUrl.origin) return {};
  return corsHeaders(origin);
}

const CORS_PREFLIGHT_HEADERS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

// Preflight handler required for cross-origin requests
export async function OPTIONS(request: NextRequest) {
  if (!isAllowedCorsOrigin(request)) {
    return new NextResponse(null, { status: 403, headers: CORS_PREFLIGHT_HEADERS });
  }
  return new NextResponse(null, { status: 204, headers: responseHeaders(request) });
}

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedCorsOrigin(request)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const limit = checkRateLimit({
      key: `leads:${clientIp(request)}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (limit.limited) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            ...responseHeaders(request),
            "Retry-After": String(Math.max(1, Math.ceil(limit.resetInMs / 1000))),
          },
        }
      );
    }

    const supabase = await createClient();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const dbForWrites =
      serviceRoleKey !== undefined && serviceRoleKey.length > 0
        ? await createServiceClient()
        : supabase;

    // ── API key auth (for cross-origin / external server submissions) ──────────
    const apiKeyHeader = request.headers.get("x-api-key");
    const origin = request.headers.get("origin");
    const requiresApiKey = !origin || origin !== request.nextUrl.origin;
    if (apiKeyHeader || requiresApiKey) {
      // leads_api_key is not in the anon-readable platform_settings allow-list — requires service role above.
      const { data: keyRow } = await dbForWrites
        .from("platform_settings")
        .select("value")
        .eq("key", "leads_api_key")
        .single();

      if (!keyRow?.value || keyRow.value !== apiKeyHeader) {
        return NextResponse.json(
          { error: "Invalid or missing API key" },
          { status: 401, headers: responseHeaders(request) }
        );
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    const parsed = leadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400, headers: responseHeaders(request) }
      );
    }
    const { full_name, email, phone, country_code, country, investment_range, message, source } = parsed.data;

    const { error } = await dbForWrites.from("leads").insert({
      full_name,
      email: email.toLowerCase(),
      phone: phone || null,
      country_code: country_code || null,
      country: country || null,
      investment_range: investment_range || null,
      message: message || null,
      source: source || "landing_page",
    });

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: responseHeaders(request) });
  } catch (error) {
    console.error("Lead submission error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to submit";
    const devDetail =
      process.env.NODE_ENV === "development"
        ? { detail: message }
        : {};
    return NextResponse.json(
      { error: "Failed to submit", ...devDetail },
      { status: 500, headers: responseHeaders(request) }
    );
  }
}
