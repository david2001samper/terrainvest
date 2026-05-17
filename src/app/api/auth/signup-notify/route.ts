import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail, sendAdminNewSignupAlert } from "@/lib/email";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", user.id)
      .single();

    if (!profile?.email) return NextResponse.json({ ok: true });

    await Promise.allSettled([
      sendWelcomeEmail(profile.email, profile.display_name || "there"),
      sendAdminNewSignupAlert(profile.display_name || "New User", profile.email),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Signup notify error:", e);
    return NextResponse.json({ ok: true });
  }
}
