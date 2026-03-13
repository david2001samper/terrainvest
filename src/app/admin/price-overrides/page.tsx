"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, Plus, Trash2, Loader2, Clock } from "lucide-react";
import { formatDateShort } from "@/lib/format";

export default function AdminPriceOverridesPage() {
  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["admin", "price-overrides"],
    queryFn: async () => {
      const res = await fetch("/api/admin/price-overrides");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 5000,
  });

  async function addOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || !price) {
      toast.error("Symbol and price required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/price-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          override_price: parseFloat(price),
          duration_seconds: parseInt(duration) || 30,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success(`Price override set for ${symbol.toUpperCase()} for ${duration}s`);
      setSymbol("");
      setPrice("");
      queryClient.invalidateQueries({ queryKey: ["admin", "price-overrides"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  }

  async function removeOverride(sym: string) {
    try {
      const res = await fetch(`/api/admin/price-overrides?symbol=${encodeURIComponent(sym)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Override removed");
      queryClient.invalidateQueries({ queryKey: ["admin", "price-overrides"] });
    } catch {
      toast.error("Failed to remove");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-amber-400" />
          Price Overrides
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Temporarily override asset prices for testing. Prices reset to API values after the duration.
        </p>
      </div>

      <Card className="glass-card accent-border">
        <CardHeader>
          <CardTitle className="text-base">Set Price Override</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addOverride} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input
                placeholder="e.g. BTC, AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="bg-background/50 mt-1"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Override Price ($)</Label>
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="bg-background/50 mt-1"
                step="any"
                min="0"
              />
            </div>
            <div className="w-32">
              <Label className="text-xs text-muted-foreground">Duration (seconds)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-background/50 mt-1"
                min="1"
                max="3600"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={adding}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Set Override
                  </>
                )}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            Duration: 1–3600 seconds. After expiry, the price reverts to the live API price.
          </p>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Active Overrides ({overrides?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-12 bg-muted/50 rounded animate-pulse" />
              <div className="h-12 bg-muted/50 rounded animate-pulse" />
            </div>
          ) : !overrides?.length ? (
            <p className="text-muted-foreground text-sm">No active overrides</p>
          ) : (
            <div className="space-y-2">
              {overrides.map((o: { id: string; symbol: string; override_price: number; expires_at: string }) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border"
                >
                  <div>
                    <span className="font-medium">{o.symbol}</span>
                    <span className="text-muted-foreground ml-2">
                      ${Number(o.override_price).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      Expires {formatDateShort(o.expires_at)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => removeOverride(o.symbol)}
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
    </div>
  );
}
