import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? "about";

    const validPages = ["about", "terms", "privacy", "contact", "support"];
    if (!validPages.includes(page)) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }

    const keyMap: Record<string, string> = {
      about: "about_us",
      terms: "terms_of_service",
      privacy: "privacy_policy",
      contact: "contact_us",
      support: "support",
    };
    const key = keyMap[page];

    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .single();

    return NextResponse.json({ content: data?.value ?? "" });
  } catch {
    return NextResponse.json({ content: "" });
  }
}
