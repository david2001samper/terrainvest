import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      if (
        error.message?.toLowerCase().includes("same") ||
        error.message?.toLowerCase().includes("different")
      ) {
        return NextResponse.json(
          { error: "New password must be different from the current one" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
