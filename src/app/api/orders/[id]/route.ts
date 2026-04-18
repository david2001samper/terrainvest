import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = (await request.json()) as {
      quantity?: unknown;
      limit_price?: unknown;
      stop_price?: unknown;
    };

    const { data: existing } = await supabase
      .from("orders")
      .select("user_id, status, order_type, limit_price, stop_price, quantity")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (existing.status !== "open") {
      return NextResponse.json({ error: "Order cannot be modified" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.quantity !== undefined) {
      const q = Number(body.quantity);
      if (!Number.isFinite(q) || q <= 0) {
        return NextResponse.json({ error: "Quantity must be greater than 0" }, { status: 400 });
      }
      updates.quantity = q;
    }
    if (body.limit_price !== undefined) {
      if (body.limit_price === null || body.limit_price === "") {
        updates.limit_price = null;
      } else {
        const limit = Number(body.limit_price);
        if (!Number.isFinite(limit) || limit <= 0) {
          return NextResponse.json({ error: "Limit price must be greater than 0" }, { status: 400 });
        }
        updates.limit_price = limit;
      }
    }
    if (body.stop_price !== undefined) {
      if (body.stop_price === null || body.stop_price === "") {
        updates.stop_price = null;
      } else {
        const stop = Number(body.stop_price);
        if (!Number.isFinite(stop) || stop <= 0) {
          return NextResponse.json({ error: "Stop price must be greater than 0" }, { status: 400 });
        }
        updates.stop_price = stop;
      }
    }

    const nextLimitPrice =
      updates.limit_price !== undefined
        ? (updates.limit_price as number | null)
        : existing.limit_price;
    const nextStopPrice =
      updates.stop_price !== undefined
        ? (updates.stop_price as number | null)
        : existing.stop_price;
    if (existing.order_type === "limit" && nextLimitPrice == null) {
      return NextResponse.json({ error: "Limit order requires a limit price" }, { status: 400 });
    }
    if (existing.order_type === "stop" && nextStopPrice == null) {
      return NextResponse.json({ error: "Stop order requires a stop price" }, { status: 400 });
    }
    if (existing.order_type === "stop-limit" && (nextLimitPrice == null || nextStopPrice == null)) {
      return NextResponse.json(
        { error: "Stop-limit order requires both stop and limit prices" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const { data: existing } = await supabase
      .from("orders")
      .select("user_id, status")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (existing.status !== "open") {
      return NextResponse.json({ error: "Order cannot be cancelled" }, { status: 400 });
    }

    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
