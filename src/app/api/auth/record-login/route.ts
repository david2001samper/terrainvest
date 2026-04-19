import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/record-login
 *
 * Called immediately after a successful signInWithPassword on the client.
 * Runs server-side so we can:
 *  - Use the service role to update profiles.last_login_at (bypasses RLS)
 *  - Capture the real client IP from request headers
 *  - Insert into login_logs with the service role (no RLS friction)
 *
 * The request carries the user's session cookie, so createClient()
 * identifies who just logged in without needing a body payload.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();

    // Real IP: Vercel / nginx set x-forwarded-for; fall back to x-real-ip.
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const userAgent = request.headers.get("user-agent") || null;

    // Use service client so updates succeed regardless of RLS on profiles/login_logs.
    const service = await createServiceClient();

    await Promise.all([
      // Keep profiles.last_login_at in sync (used as a fast cache by some queries).
      service
        .from("profiles")
        .update({ last_login_at: now })
        .eq("id", user.id),

      // Insert a login log entry with real IP.
      service.from("login_logs").insert({
        user_id: user.id,
        ip,
        user_agent: userAgent,
        created_at: now,
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Non-fatal — the user is already logged in; just log the failure.
    console.error("record-login error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
