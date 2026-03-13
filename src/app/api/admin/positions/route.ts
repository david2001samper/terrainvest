import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("id");

    if (!positionId) {
      return NextResponse.json({ error: "Position ID required" }, { status: 400 });
    }

    const { data: position } = await supabase
      .from("positions")
      .select("*")
      .eq("id", positionId)
      .single();

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }

    await supabase.from("positions").delete().eq("id", positionId);

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", position.user_id)
      .single();

    if (userProfile) {
      await supabase
        .from("profiles")
        .update({
          balance: userProfile.balance + position.current_value,
        })
        .eq("id", position.user_id);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
