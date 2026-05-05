import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileUpdateSchema = z.object({
  display_name: z.string().trim().min(1).max(80).nullable().optional(),
  preferred_currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Preferred currency must be a 3-letter code")
    .nullable()
    .optional(),
  avatar_url: z
    .string()
    .trim()
    .url("Avatar URL must be valid")
    .refine((value) => value.startsWith("https://"), "Avatar URL must use HTTPS")
    .nullable()
    .optional(),
  notify_withdrawal: z.boolean().optional(),
  notify_deposit: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error);
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = profileUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.display_name !== undefined) updates.display_name = body.display_name;
    if (body.preferred_currency !== undefined) updates.preferred_currency = body.preferred_currency;
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;
    if (typeof body.notify_withdrawal === "boolean") updates.notify_withdrawal = body.notify_withdrawal;
    if (typeof body.notify_deposit === "boolean") updates.notify_deposit = body.notify_deposit;

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
