import { NextResponse, type NextRequest } from "next/server";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await params;

    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", userId)
      .order("symbol");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("Positions error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await params;
    const body = await request.json();
    const { positionId, quantity, price } = body;

    if (!positionId) {
      return NextResponse.json({ error: "positionId required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (quantity !== undefined) updates.quantity = quantity;
    if (price !== undefined) updates.entry_price = price;

    const { data: pos } = await supabase
      .from("positions")
      .select("*")
      .eq("id", positionId)
      .eq("user_id", userId)
      .single();

    if (!pos) return NextResponse.json({ error: "Position not found" }, { status: 404 });

    if (quantity !== undefined && quantity <= 0) {
      const { error: delErr } = await supabase
        .from("positions")
        .delete()
        .eq("id", positionId);
      if (delErr) throw delErr;
      return NextResponse.json({ success: true, deleted: true });
    }

    if (price !== undefined && quantity !== undefined) {
      updates.current_value = quantity * price;
    } else if (quantity !== undefined) {
      updates.current_value = quantity * pos.entry_price;
    } else if (price !== undefined) {
      updates.current_value = pos.quantity * price;
    }

    const { data, error } = await supabase
      .from("positions")
      .update(updates)
      .eq("id", positionId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Update position error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await params;
    const body = await request.json();
    const { symbol, quantity, entry_price } = body;

    if (!symbol || !quantity || quantity <= 0 || !entry_price) {
      return NextResponse.json({ error: "symbol, quantity, entry_price required" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", userId)
      .eq("symbol", symbol)
      .single();

    if (existing) {
      const newQty = existing.quantity + parseFloat(quantity);
      const newAvg = (existing.entry_price * existing.quantity + entry_price * quantity) / newQty;
      const { data, error } = await supabase
        .from("positions")
        .update({
          quantity: newQty,
          entry_price: newAvg,
          current_value: newQty * newAvg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("positions")
      .insert({
        user_id: userId,
        symbol,
        quantity: parseFloat(quantity),
        entry_price: parseFloat(entry_price),
        current_value: parseFloat(quantity) * parseFloat(entry_price),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Add position error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get("positionId");

    if (!positionId) {
      return NextResponse.json({ error: "positionId required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("positions")
      .delete()
      .eq("id", positionId)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete position error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
