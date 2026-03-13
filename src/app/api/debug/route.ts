import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not logged in", fix: "Log in first at /auth/login" });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Also check with service client to see the real state
    const serviceClient = await createServiceClient();
    const { data: adminProfile } = await serviceClient
      .from("profiles")
      .select("id, email, role")
      .eq("email", "admin@terrainvestvip.com")
      .single();

    return NextResponse.json({
      logged_in_as: user.email,
      user_id: user.id,
      profile_from_rls: profile,
      profile_error: error?.message || null,
      admin_profile_in_db: adminProfile,
      is_admin_account: user.email === "admin@terrainvestvip.com",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) });
  }
}
