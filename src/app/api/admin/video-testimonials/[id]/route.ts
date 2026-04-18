import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.video_url !== undefined) updates.video_url = body.video_url;
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;
    if (body.client_name !== undefined) updates.client_name = body.client_name;
    if (body.quote !== undefined) updates.quote = body.quote;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.visible !== undefined) updates.visible = body.visible;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("video_testimonials")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    revalidateTag("testimonials", "max");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Video testimonial update error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const { error } = await supabase
      .from("video_testimonials")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidateTag("testimonials", "max");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Video testimonial delete error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
