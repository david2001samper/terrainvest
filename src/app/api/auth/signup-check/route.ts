import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const requestLog = new Map<string, number[]>();

const bodySchema = z.object({
  email: z.string().email("Invalid email address"),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number"),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function rateLimitKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);
  recent.push(now);
  requestLog.set(key, recent);
  return recent.length > MAX_ATTEMPTS_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Signup checks are not configured (missing service role key)." },
      { status: 503 }
    );
  }

  if (isRateLimited(rateLimitKey(request))) {
    return NextResponse.json(
      { error: "Too many signup checks. Please try again shortly." },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const phoneE164 = parsed.data.phoneE164;

  try {
    const supabase = await createServiceClient();

    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (byEmail) {
      return NextResponse.json({ available: false }, { status: 200 });
    }

    const { data: byPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_e164", phoneE164)
      .maybeSingle();

    if (byPhone) {
      return NextResponse.json({ available: false }, { status: 200 });
    }

    return NextResponse.json({ available: true });
  } catch (e) {
    console.error("signup-check:", e);
    return NextResponse.json({ error: "Could not verify availability" }, { status: 500 });
  }
}
