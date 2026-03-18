"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, Plus, Trash2, Loader2, Clock, Link2, Play, Square, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateShort } from "@/lib/format";

interface ChainStep {
  id: string;
  price: string;
  duration: string;
}

export default function AdminPriceOverridesPage() {
  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const [chainSymbol, setChainSymbol] = useState("");
  const [chainSteps, setChainSteps] = useState<ChainStep[]>([
    { id: crypto.randomUUID(), price: "", duration: "5" },
  ]);
  const [chainRunning, setChainRunning] = useState(false);
  const [chainCurrentStep, setChainCurrentStep] = useState(-1);
  const [chainOpen, setChainOpen] = useState(false);
  const [chainEndTime, setChainEndTime] = useState<number | null>(null);
  const [chainTimeLeft, setChainTimeLeft] = useState(0);
  const chainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["admin", "price-overrides"],
    queryFn: async () => {
      const res = await fetch("/api/admin/price-overrides");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!chainRunning || !chainEndTime) return;
    chainTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((chainEndTime - Date.now()) / 1000));
      setChainTimeLeft(remaining);

      const validSteps = chainSteps.filter(
        (s) => s.price && parseFloat(s.price) > 0 && s.duration && parseInt(s.duration) > 0
      );
      let elapsed = 0;
      let currentIdx = 0;
      const elapsedSoFar = Math.floor((Date.now() - (chainEndTime - totalChainDuration * 1000)) / 1000);
      for (let i = 0; i < validSteps.length; i++) {
        elapsed += parseInt(validSteps[i].duration) || 0;
        if (elapsedSoFar < elapsed) {
          currentIdx = i;
          break;
        }
        if (i === validSteps.length - 1) currentIdx = i;
      }
      setChainCurrentStep(currentIdx);

      if (remaining <= 0) {
        setChainRunning(false);
        setChainCurrentStep(-1);
        setChainEndTime(null);
        if (chainTimerRef.current) clearInterval(chainTimerRef.current);
      }
    }, 500);
    return () => {
      if (chainTimerRef.current) clearInterval(chainTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainRunning, chainEndTime]);

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

  function addChainStep() {
    setChainSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), price: "", duration: "5" },
    ]);
  }

  function removeChainStep(id: string) {
    setChainSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function updateChainStep(id: string, field: "price" | "duration", value: string) {
    setChainSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  function moveChainStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= chainSteps.length) return;
    setChainSteps((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function runChain() {
    const sym = chainSymbol.trim().toUpperCase();
    if (!sym) {
      toast.error("Enter a symbol for the chain");
      return;
    }
    const validSteps = chainSteps
      .filter((s) => s.price && parseFloat(s.price) > 0 && s.duration && parseInt(s.duration) > 0)
      .map((s) => ({
        price: parseFloat(s.price),
        duration: parseInt(s.duration),
      }));
    if (validSteps.length === 0) {
      toast.error("Add at least one valid step");
      return;
    }

    setChainRunning(true);
    setChainCurrentStep(0);

    try {
      const res = await fetch("/api/admin/price-overrides/chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym, steps: validSteps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      const total = data.total_duration as number;
      setChainEndTime(Date.now() + total * 1000);
      setChainTimeLeft(total);
      toast.success(`Chain started for ${sym} — ${validSteps.length} steps, ${total}s total`);
      queryClient.invalidateQueries({ queryKey: ["admin", "price-overrides"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start chain");
      setChainRunning(false);
      setChainCurrentStep(-1);
    }
  }

  async function stopChain() {
    const sym = chainSymbol.trim().toUpperCase();
    try {
      await fetch(`/api/admin/price-overrides/chain?symbol=${encodeURIComponent(sym)}`, {
        method: "DELETE",
      });
    } catch { /* ignore */ }
    setChainRunning(false);
    setChainCurrentStep(-1);
    setChainEndTime(null);
    if (chainTimerRef.current) clearInterval(chainTimerRef.current);
    queryClient.invalidateQueries({ queryKey: ["admin", "price-overrides"] });
    toast.info("Chain stopped");
  }

  const totalChainDuration = chainSteps.reduce(
    (sum, s) => sum + (parseInt(s.duration) || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-amber-400" />
          Price Overrides
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Temporarily override asset prices. Prices reset to API values after the duration.
        </p>
      </div>

      {/* Single Override */}
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

      {/* Price Chain */}
      <Card className="glass-card border-purple-500/20">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setChainOpen(!chainOpen)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-purple-400" />
              Price Chain
              {chainRunning && (
                <Badge className="bg-purple-500/20 text-purple-400 ml-2 animate-pulse text-[10px]">
                  Step {chainCurrentStep + 1}/{chainSteps.filter((s) => s.price && s.duration).length} — {chainTimeLeft}s left
                </Badge>
              )}
            </CardTitle>
            {chainOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Queue multiple price overrides that execute one after another on the server. Prices are locked during the full chain — no real data leaks through.
          </p>
        </CardHeader>
        {chainOpen && (
          <CardContent className="space-y-4">
            <div className="max-w-xs">
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input
                placeholder="e.g. BTC"
                value={chainSymbol}
                onChange={(e) => setChainSymbol(e.target.value.toUpperCase())}
                className="bg-background/50 mt-1"
                disabled={chainRunning}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Steps ({chainSteps.length}) — Total duration: {totalChainDuration}s
              </Label>
              {chainSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border ${
                    chainRunning && chainCurrentStep === idx
                      ? "border-purple-500/50 bg-purple-500/10"
                      : "border-border bg-background/50"
                  }`}
                >
                  <span className="text-xs text-muted-foreground font-mono w-6 shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Price ($)"
                      value={step.price}
                      onChange={(e) => updateChainStep(step.id, "price", e.target.value)}
                      className="bg-background/50 h-8 text-sm"
                      step="any"
                      min="0"
                      disabled={chainRunning}
                    />
                    <Input
                      type="number"
                      placeholder="Sec"
                      value={step.duration}
                      onChange={(e) => updateChainStep(step.id, "duration", e.target.value)}
                      className="bg-background/50 h-8 text-sm w-20"
                      min="1"
                      max="3600"
                      disabled={chainRunning}
                    />
                    <span className="text-xs text-muted-foreground shrink-0">sec</span>
                  </div>
                  {!chainRunning && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveChainStep(idx, -1)}
                        disabled={idx === 0}
                        className="h-6 w-6"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => moveChainStep(idx, 1)}
                        disabled={idx === chainSteps.length - 1}
                        className="h-6 w-6"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeChainStep(step.id)}
                        disabled={chainSteps.length <= 1}
                        className="h-6 w-6 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  {chainRunning && chainCurrentStep === idx && (
                    <Badge className="bg-purple-500/20 text-purple-400 text-[10px] animate-pulse shrink-0">
                      Active
                    </Badge>
                  )}
                  {chainRunning && chainCurrentStep > idx && (
                    <Badge className="bg-green-500/20 text-green-400 text-[10px] shrink-0">
                      Done
                    </Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {!chainRunning && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChainStep}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              )}
              {!chainRunning ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={runChain}
                  disabled={
                    !chainSymbol ||
                    chainSteps.every((s) => !s.price || !s.duration)
                  }
                  className="bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Chain ({totalChainDuration}s total)
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={stopChain}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Chain
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Active Overrides */}
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
