"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Activity } from "lucide-react";
import Link from "next/link";
import type { OptionContract } from "@/lib/types";

interface ChainData {
  expirationDates: number[];
  calls: OptionContract[];
  puts: OptionContract[];
  underlyingPrice: number;
}

function parseExpiryToDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    // numeric string (seconds/ms)
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      const ms = n > 1e12 ? n : n * 1000;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // ISO / date-like string
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function OptionsChainPage() {
  const params = useParams();
  const symbol = decodeURIComponent(params.symbol as string);
  const { format: formatCurrency } = useCurrencyFormat();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [buyDialog, setBuyDialog] = useState<OptionContract | null>(null);
  const [buyQty, setBuyQty] = useState("1");
  const [buyLoading, setBuyLoading] = useState(false);

  const expiryParam = selectedExpiry || undefined;

  const { data: chainData, isLoading } = useQuery<ChainData>({
    queryKey: ["options-chain", symbol, expiryParam],
    queryFn: async () => {
      const p = new URLSearchParams({ symbol });
      if (expiryParam) p.set("expiry", expiryParam);
      const res = await fetch(`/api/market/options/chain?${p}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const expiryDates = useMemo(
    () => {
      const raw = chainData?.expirationDates ?? [];
      const mapped = raw
        .map((ts) => {
          const d = parseExpiryToDate(ts);
          if (!d) return null;
          return {
            // Keep the original primitive value for API call consistency
            value: String(ts),
            label: d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            sortTs: d.getTime(),
          };
        })
        .filter((x): x is { value: string; label: string; sortTs: number } => x !== null)
        .sort((a, b) => a.sortTs - b.sortTs);

      return mapped.map(({ value, label }) => ({ value, label }));
    },
    [chainData]
  );

  const calls = chainData?.calls ?? [];
  const puts = chainData?.puts ?? [];
  const underlyingPrice = chainData?.underlyingPrice ?? 0;

  const allStrikes = useMemo(() => {
    const set = new Set<number>();
    calls.forEach((c) => set.add(c.strike));
    puts.forEach((p) => set.add(p.strike));
    return Array.from(set).sort((a, b) => a - b);
  }, [calls, puts]);

  const callMap = useMemo(() => {
    const m = new Map<number, OptionContract>();
    calls.forEach((c) => m.set(c.strike, c));
    return m;
  }, [calls]);

  const putMap = useMemo(() => {
    const m = new Map<number, OptionContract>();
    puts.forEach((p) => m.set(p.strike, p));
    return m;
  }, [puts]);

  async function handleBuy() {
    if (!buyDialog) return;
    const qty = parseInt(buyQty) || 0;
    if (qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setBuyLoading(true);
    try {
      const res = await fetch("/api/options/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buy",
          contract_symbol: buyDialog.contractSymbol,
          underlying_symbol: symbol,
          option_type: buyDialog.type,
          strike: buyDialog.strike,
          expiry: buyDialog.expiry,
          quantity: qty,
          premium: buyDialog.ask > 0 ? buyDialog.ask : buyDialog.lastPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Trade failed");
        return;
      }
      toast.success(data.message);
      setBuyDialog(null);
      setBuyQty("1");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["options-positions"] });
    } catch {
      toast.error("Trade failed");
    } finally {
      setBuyLoading(false);
    }
  }

  const CONTRACT_SIZE = 100;
  const buyPremium = buyDialog
    ? buyDialog.ask > 0
      ? buyDialog.ask
      : buyDialog.lastPrice
    : 0;
  const buyCost = buyPremium * (parseInt(buyQty) || 0) * CONTRACT_SIZE;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/markets"
          className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          Markets
        </Link>
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#00D4FF]" />
          <div>
            <h1 className="text-2xl font-bold">{symbol} Options Chain</h1>
            {underlyingPrice > 0 && (
              <p className="text-sm text-muted-foreground">
                Underlying: {formatCurrency(underlyingPrice)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Expiry selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground">Expiration:</Label>
        <Select
          value={selectedExpiry}
          onValueChange={(v) => setSelectedExpiry(v)}
        >
          <SelectTrigger className="w-[200px] bg-background/50 border-border h-10">
            <SelectValue placeholder="Nearest expiry" />
          </SelectTrigger>
          <SelectContent>
            {expiryDates.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : allStrikes.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No options data available for {symbol}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">
              Calls &amp; Puts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead
                      colSpan={5}
                      className="text-center text-green-400 text-xs uppercase border-r border-border"
                    >
                      Calls
                    </TableHead>
                    <TableHead className="text-center text-xs uppercase text-muted-foreground border-r border-border">
                      Strike
                    </TableHead>
                    <TableHead
                      colSpan={5}
                      className="text-center text-red-400 text-xs uppercase"
                    >
                      Puts
                    </TableHead>
                  </TableRow>
                  <TableRow className="border-border hover:bg-transparent text-[10px] uppercase text-muted-foreground">
                    <TableHead className="text-right">Bid</TableHead>
                    <TableHead className="text-right">Ask</TableHead>
                    <TableHead className="text-right">Last</TableHead>
                    <TableHead className="text-right">Vol</TableHead>
                    <TableHead className="text-right border-r border-border">OI</TableHead>
                    <TableHead className="text-center border-r border-border">Price</TableHead>
                    <TableHead className="text-right">Bid</TableHead>
                    <TableHead className="text-right">Ask</TableHead>
                    <TableHead className="text-right">Last</TableHead>
                    <TableHead className="text-right">Vol</TableHead>
                    <TableHead className="text-right">OI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allStrikes.map((strike) => {
                    const call = callMap.get(strike);
                    const put = putMap.get(strike);
                    const isITMCall = underlyingPrice > 0 && strike < underlyingPrice;
                    const isITMPut = underlyingPrice > 0 && strike > underlyingPrice;
                    return (
                      <TableRow
                        key={strike}
                        className="border-border hover:bg-accent/20 text-xs"
                      >
                        {/* Call side */}
                        <TableCell
                          className={`text-right cursor-pointer hover:text-green-400 ${isITMCall ? "bg-green-500/5" : ""}`}
                          onClick={() => call && setBuyDialog(call)}
                        >
                          {call ? formatCurrency(call.bid, 2) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right cursor-pointer hover:text-green-400 ${isITMCall ? "bg-green-500/5" : ""}`}
                          onClick={() => call && setBuyDialog(call)}
                        >
                          {call ? formatCurrency(call.ask, 2) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${isITMCall ? "bg-green-500/5" : ""}`}
                        >
                          {call ? formatCurrency(call.lastPrice, 2) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${isITMCall ? "bg-green-500/5" : ""}`}
                        >
                          {call?.volume?.toLocaleString() ?? "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right border-r border-border ${isITMCall ? "bg-green-500/5" : ""}`}
                        >
                          {call?.openInterest?.toLocaleString() ?? "—"}
                        </TableCell>

                        {/* Strike */}
                        <TableCell className="text-center font-medium border-r border-border">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${
                              Math.abs(strike - underlyingPrice) <
                              underlyingPrice * 0.005
                                ? "border-[#00D4FF] text-[#00D4FF]"
                                : "border-border"
                            }`}
                          >
                            {formatCurrency(strike, 2)}
                          </Badge>
                        </TableCell>

                        {/* Put side */}
                        <TableCell
                          className={`text-right cursor-pointer hover:text-red-400 ${isITMPut ? "bg-red-500/5" : ""}`}
                          onClick={() => put && setBuyDialog(put)}
                        >
                          {put ? formatCurrency(put.bid, 2) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right cursor-pointer hover:text-red-400 ${isITMPut ? "bg-red-500/5" : ""}`}
                          onClick={() => put && setBuyDialog(put)}
                        >
                          {put ? formatCurrency(put.ask, 2) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${isITMPut ? "bg-red-500/5" : ""}`}
                        >
                          {put ? formatCurrency(put.lastPrice, 2) : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${isITMPut ? "bg-red-500/5" : ""}`}
                        >
                          {put?.volume?.toLocaleString() ?? "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right ${isITMPut ? "bg-red-500/5" : ""}`}
                        >
                          {put?.openInterest?.toLocaleString() ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buy dialog */}
      <Dialog
        open={!!buyDialog}
        onOpenChange={(open) => {
          if (!open) setBuyDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Buy{" "}
              <span
                className={
                  buyDialog?.type === "call" ? "text-green-400" : "text-red-400"
                }
              >
                {buyDialog?.type === "call" ? "Call" : "Put"}
              </span>{" "}
              Option
            </DialogTitle>
            <DialogDescription>
              {buyDialog?.contractSymbol} — Strike{" "}
              {formatCurrency(buyDialog?.strike ?? 0, 2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Bid</p>
                <p className="font-medium">
                  {formatCurrency(buyDialog?.bid ?? 0, 2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Ask</p>
                <p className="font-medium">
                  {formatCurrency(buyDialog?.ask ?? 0, 2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">IV</p>
                <p className="font-medium">
                  {((buyDialog?.impliedVolatility ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Contracts (x{CONTRACT_SIZE} shares each)
              </Label>
              <Input
                type="number"
                value={buyQty}
                onChange={(e) => setBuyQty(e.target.value)}
                min="1"
                step="1"
                className="bg-background/50 border-border focus:border-[#00D4FF] h-10"
              />
            </div>
            <div className="p-3 rounded-lg bg-background/60 border border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Premium per contract</span>
                <span className="font-medium">
                  {formatCurrency(buyPremium, 2)} × {CONTRACT_SIZE} ={" "}
                  {formatCurrency(buyPremium * CONTRACT_SIZE, 2)}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm">
                <span className="font-medium">Total Cost</span>
                <span className="font-semibold">{formatCurrency(buyCost, 2)}</span>
              </div>
              {profile && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Balance</span>
                  <span
                    className={
                      profile.balance >= buyCost
                        ? "text-foreground"
                        : "text-red-400"
                    }
                  >
                    {formatCurrency(profile.balance)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleBuy}
              disabled={buyLoading || buyCost <= 0}
              className={
                buyDialog?.type === "call"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {buyLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Buy ${parseInt(buyQty) || 0} Contract(s)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
