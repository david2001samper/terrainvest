import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  email: z.string().email("Invalid email address"),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Invalid phone number"),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Signup checks are not configured (missing service role key)." },
      { status: 503 }
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
      return NextResponse.json(
        { available: false, field: "email", message: "This email is already registered." },
        { status: 409 }
      );
    }

    const { data: byPhone } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone_e164", phoneE164)
      .maybeSingle();

    if (byPhone) {
      return NextResponse.json(
        { available: false, field: "phone", message: "This phone number is already registered." },
        { status: 409 }
      );
    }

    return NextResponse.json({ available: true });
  } catch (e) {
    console.error("signup-check:", e);
    return NextResponse.json({ error: "Could not verify availability" }, { status: 500 });
  }
}
