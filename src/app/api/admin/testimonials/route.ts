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

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("client_testimonials")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Testimonials error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { headshot_url, quote, attribution, sort_order, visible } = body;

    if (!headshot_url || !quote || !attribution) {
      return NextResponse.json(
        { error: "headshot_url, quote, and attribution are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("client_testimonials")
      .insert({
        headshot_url,
        quote,
        attribution,
        sort_order: sort_order ?? 0,
        visible: visible ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    revalidateTag("testimonials");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Testimonial create error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
