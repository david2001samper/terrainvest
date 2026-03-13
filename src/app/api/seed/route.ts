import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  return seed();
}

export async function POST() {
  return seed();
}

async function seed() {
  try {
    const supabase = await createServiceClient();

    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const adminUser = existingUser?.users?.find(
      (u) => u.email === "admin@terrainvestvip.com"
    );

    let userId: string;

    if (!adminUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: "admin@terrainvestvip.com",
        password: "admin123",
        email_confirm: true,
        user_metadata: { display_name: "Platform Admin" },
      });

      if (error) {
        console.error("Admin creation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      userId = data.user.id;
    } else {
      userId = adminUser.id;
    }

    await supabase
      .from("profiles")
      .update({
        role: "admin",
        display_name: "Platform Admin",
        vip_level: 5,
      })
      .eq("id", userId);

    return NextResponse.json({
      message: adminUser ? "Admin role granted" : "Admin account created",
      admin: true,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
