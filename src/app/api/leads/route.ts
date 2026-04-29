import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// CORS headers — allow any origin so external ad servers can POST here
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

// Preflight handler required for cross-origin requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── API key auth (for cross-origin / external server submissions) ──────────
    const apiKeyHeader = request.headers.get("x-api-key");
    if (apiKeyHeader) {
      const { data: keyRow } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "leads_api_key")
        .single();

      if (!keyRow?.value || keyRow.value !== apiKeyHeader) {
        return NextResponse.json(
          { error: "Invalid API key" },
          { status: 401, headers: CORS_HEADERS }
        );
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    const body = await request.json();
    const { full_name, email, phone, country_code, country, investment_range, message, source } = body;

    if (!full_name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { error } = await supabase.from("leads").insert({
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      country_code: country_code?.trim() || null,
      country: country?.trim() || null,
      investment_range: investment_range || null,
      message: message?.trim() || null,
      source: source?.trim() || "landing_page",
    });

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Lead submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
