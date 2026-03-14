import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["wallet_btc", "wallet_usdt"]);

    const settings: Record<string, string> = {};
    (data ?? []).forEach((r) => {
      settings[r.key] = r.value;
    });

    return NextResponse.json({
      wallet_btc: settings.wallet_btc ?? "",
      wallet_usdt: settings.wallet_usdt ?? "",
    });
  } catch {
    return NextResponse.json({ wallet_btc: "", wallet_usdt: "" });
  }
}
