"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Wallet, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  entry_price: number;
  current_value: number;
}

export default function AdminClientDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const queryClient = useQueryClient();
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addSymbol, setAddSymbol] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["admin", "client", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/clients/${userId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ["admin", "positions", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/clients/${userId}/positions`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: assets } = useQuery<{ id: string; symbol: string }[]>({
    queryKey: ["admin", "assets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/assets");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function saveEdit() {
    if (!editPos) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${userId}/positions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positionId: editPos.id,
          quantity: parseFloat(editQty),
          price: parseFloat(editPrice),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Position updated");
      setEditPos(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "positions", userId] });
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function deletePosition(pos: Position) {
    if (!confirm(`Remove ${pos.symbol}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${userId}/positions?positionId=${pos.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Position removed");
      queryClient.invalidateQueries({ queryKey: ["admin", "positions", userId] });
    } catch {
      toast.error("Failed to remove");
    } finally {
      setSaving(false);
    }
  }

  async function addPosition() {
    if (!addSymbol || !addQty || !addPrice || parseFloat(addQty) <= 0 || parseFloat(addPrice) <= 0) {
      toast.error("Fill all fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${userId}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: addSymbol,
          quantity: parseFloat(addQty),
          entry_price: parseFloat(addPrice),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Position added");
      setAddOpen(false);
      setAddSymbol("");
      setAddQty("");
      setAddPrice("");
      queryClient.invalidateQueries({ queryKey: ["admin", "positions", userId] });
    } catch {
      toast.error("Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#00D4FF]" />
            Portfolio: {profile?.display_name || profile?.email || "User"}
          </h1>
          <p className="text-muted-foreground text-sm">{profile?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
            <p className="text-xl font-bold">{formatCurrency(profile?.balance)}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total P&L</p>
            <p className={`text-xl font-bold ${(profile?.total_pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {formatCurrency(profile?.total_pnl)}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Positions</p>
            <p className="text-xl font-bold">{positions?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Positions</CardTitle>
            <Button size="sm" onClick={() => setAddOpen(true)} className="accent-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Add Position
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !positions?.length ? (
            <p className="text-muted-foreground text-center py-8">No positions</p>
          ) : (
            <div className="space-y-3">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border"
                >
                  <div>
                    <p className="font-medium">{pos.symbol}</p>
                    <p className="text-sm text-muted-foreground">
                      {pos.quantity} @ {formatCurrency(pos.entry_price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{formatCurrency(pos.current_value)}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditPos(pos);
                        setEditQty(String(pos.quantity));
                        setEditPrice(String(pos.entry_price));
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400"
                      onClick={() => deletePosition(pos)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editPos} onOpenChange={() => setEditPos(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editPos && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editPos.symbol}</p>
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
                <Label>Entry Price</Label>
                <Input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  min="0"
                  step="any"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditPos(null)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={saveEdit} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Select value={addSymbol} onValueChange={(v) => setAddSymbol(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets?.map((a) => (
                    <SelectItem key={a.id} value={a.symbol}>
                      {a.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
              />
            </div>
            <div className="space-y-2">
              <Label>Entry Price</Label>
              <Input
                type="number"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={addPosition} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
