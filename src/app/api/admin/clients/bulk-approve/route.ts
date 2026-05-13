import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { userIds } = body as { userIds?: string[] };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "userIds array required" }, { status: 400 });
    }

    if (userIds.length > 200) {
      return NextResponse.json({ error: "Maximum 200 users per batch" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .in("id", userIds);

    if (error) throw error;

    return NextResponse.json({ success: true, approved: userIds.length });
  } catch (error) {
    console.error("Bulk approve error:", error);
    return NextResponse.json({ error: "Failed to approve users" }, { status: 500 });
  }
}
