import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDebugRouteEnabled } from "@/lib/server-flags";

export async function GET() {
  if (!isDebugRouteEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, role, created_at, updated_at")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      logged_in_as: user.email,
      user_id: user.id,
      profile_from_rls: profile,
      profile_error: error?.message || null,
      is_admin_account: user.email === "admin@terrainvestvip.com",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
