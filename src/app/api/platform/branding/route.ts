import { NextResponse } from "next/server";
import { getPlatformBranding } from "@/lib/platform-config.server";

export async function GET() {
  try {
    const branding = await getPlatformBranding();
    return NextResponse.json(branding, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    const { BRANDING_DEFAULTS } = await import("@/lib/platform-config");
    return NextResponse.json(BRANDING_DEFAULTS);
  }
}
