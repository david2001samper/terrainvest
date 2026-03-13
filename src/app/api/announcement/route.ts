import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "announcement")
      .single();

    const text = data?.value?.trim() ?? "";
    return NextResponse.json({ announcement: text });
  } catch {
    return NextResponse.json({ announcement: "" });
  }
}
