import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { processOpenOrders } from "@/lib/orders/processor";

function hasValidProcessorSecret(request: NextRequest) {
  const expected = process.env.ORDER_PROCESSOR_KEY;
  if (!expected) return false;
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length) === expected;
  }
  const headerKey = request.headers.get("x-order-processor-key");
  return headerKey === expected;
}

export async function POST(request: NextRequest) {
  try {
    const service = await createServiceClient();

    if (hasValidProcessorSecret(request)) {
      const summary = await processOpenOrders(service, { maxOrders: 500 });
      return NextResponse.json({ mode: "all", ...summary });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const summary = await processOpenOrders(service, {
      userId: user.id,
      maxOrders: 100,
    });
    return NextResponse.json({ mode: "user", ...summary });
  } catch (error) {
    console.error("Order processor error:", error);
    return NextResponse.json({ error: "Failed to process orders" }, { status: 500 });
  }
}
