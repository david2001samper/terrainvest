"use client";

import { useState } from "react";
import { useOrders } from "@/hooks/use-orders";
import { formatDateShort } from "@/lib/format";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ClipboardList, X, Pencil, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OrdersPage() {
  const { format: formatCurrency } = useCurrencyFormat();
  const { data: orders, isLoading, invalidate } = useOrders();
  const [editing, setEditing] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editLimit, setEditLimit] = useState("");
  const [editStop, setEditStop] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCancel(id: string) {
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success("Order cancelled");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    }
  }

  function openEdit(order: { id: string; quantity: number; limit_price: number | null; stop_price: number | null }) {
    setEditing(order.id);
    setEditQty(String(order.quantity));
    setEditLimit(order.limit_price ? String(order.limit_price) : "");
    setEditStop(order.stop_price ? String(order.stop_price) : "");
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { quantity: parseFloat(editQty) };
      if (editLimit) body.limit_price = parseFloat(editLimit);
      if (editStop) body.stop_price = parseFloat(editStop);

      const res = await fetch(`/api/orders/${editing}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success("Order updated");
      setEditing(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-[#00D4FF]" />
          Pending Orders
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your open limit and stop orders
        </p>
      </div>

      <Card className="glass-card accent-border">
        <CardHeader>
          <CardTitle className="text-base">Open Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No pending orders
            </p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{order.symbol}</span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${
                          order.side === "buy"
                            ? "bg-green-600/20 text-green-400"
                            : "bg-red-600/20 text-[#E53E3E]"
                        }`}
                      >
                        {order.side.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.order_type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Qty: {order.quantity}
                      {order.limit_price != null && ` @ ${formatCurrency(order.limit_price)}`}
                      {order.stop_price != null && ` stop ${formatCurrency(order.stop_price)}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateShort(order.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(order)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleCancel(order.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Order</DialogTitle>
            <DialogDescription>
              Update quantity or limit/stop prices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label>Limit Price (optional)</Label>
              <Input
                type="number"
                value={editLimit}
                onChange={(e) => setEditLimit(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label>Stop Price (optional)</Label>
              <Input
                type="number"
                value={editStop}
                onChange={(e) => setEditStop(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
