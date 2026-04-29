import { NextResponse } from "next/server";
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

function generateApiKey(): string {
  // 40-char hex key: 20 random bytes
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// GET — return the current key (or create one if missing)
export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "leads_api_key")
      .single();

    if (data?.value) {
      return NextResponse.json({ api_key: data.value, is_new: false });
    }

    // Auto-generate on first request
    const newKey = generateApiKey();
    await supabase
      .from("platform_settings")
      .upsert({ key: "leads_api_key", value: newKey, updated_at: new Date().toISOString() }, { onConflict: "key" });

    return NextResponse.json({ api_key: newKey, is_new: true });
  } catch (error) {
    console.error("API key GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST — regenerate the key
export async function POST() {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const newKey = generateApiKey();
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "leads_api_key", value: newKey, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) throw error;

    return NextResponse.json({ api_key: newKey, is_new: true });
  } catch (error) {
    console.error("API key POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
