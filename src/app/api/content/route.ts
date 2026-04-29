import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_PUBLIC_CONTENT, getPublicContentPage } from "@/lib/public-content";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? "about";
    const pageMeta = getPublicContentPage(page);
    if (!pageMeta) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", pageMeta.key)
      .single();

    return NextResponse.json({ content: data?.value || DEFAULT_PUBLIC_CONTENT[pageMeta.key] || "" }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ content: "" });
  }
}
