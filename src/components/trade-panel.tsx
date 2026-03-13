"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useProfile } from "@/hooks/use-profile";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";

type OrderType = "market" | "limit" | "stop" | "stop-limit";

interface TradePanelProps {
  symbol: string;
  name: string;
  price: number;
  compact?: boolean;
}

export function TradePanel({ symbol, name, price, compact = false }: TradePanelProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: profile } = useProfile();
  const { format: formatCurrency } = useCurrencyFormat();
  const queryClient = useQueryClient();

  const { data: platformSettings } = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/platform/settings");
      if (!res.ok) return { fee_per_trade: 0.1 };
      return res.json();
    },
    staleTime: 60000,
  });

  const feePerTrade = platformSettings?.fee_per_trade ?? 0.1;

  const qty = parseFloat(quantity) || 0;
  const execPrice =
    orderType === "market"
      ? price
      : orderType === "limit"
      ? parseFloat(limitPrice) || price
      : orderType === "stop"
      ? parseFloat(stopPrice) || price
      : parseFloat(limitPrice) || price;

  const preview = useMemo(() => {
    const subtotal = qty * execPrice;
    const fee = qty > 0 ? feePerTrade : 0;
    const total = side === "buy" ? subtotal + fee : subtotal - fee;
    const balanceAfter =
      side === "buy"
        ? (profile?.balance ?? 0) - total
        : (profile?.balance ?? 0) + subtotal - fee;
    return { subtotal, fee, total, balanceAfter };
  }, [qty, execPrice, side, profile?.balance, feePerTrade]);

  function handleSubmit() {
    if (qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (orderType === "market") {
      setConfirmOpen(true);
    } else {
      submitLimitOrder();
    }
  }

  async function submitLimitOrder() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          order_type: orderType,
          quantity: qty,
          limit_price: limitPriceVal,
          stop_price: stopPriceVal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Order failed");
        return;
      }
      toast.success("Order placed successfully");
      setQuantity("");
      setLimitPrice("");
      setStopPrice("");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch {
      toast.error("Order placement failed");
    } finally {
      setLoading(false);
    }
  }

  async function executeTrade() {
    setLoading(true);
    toast.info("Processing your order...");
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, quantity: qty, price: execPrice }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Trade failed");
        return;
      }
      toast.success(data.message);
      setConfirmOpen(false);
      setQuantity("");
      setLimitPrice("");
      setStopPrice("");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    } catch {
      toast.error("Trade execution failed");
    } finally {
      setLoading(false);
    }
  }

  const showLimitInput = orderType === "limit" || orderType === "stop-limit";
  const showStopInput = orderType === "stop" || orderType === "stop-limit";

  const limitPriceVal = showLimitInput ? (parseFloat(limitPrice) || execPrice) : null;
  const stopPriceVal = showStopInput ? (parseFloat(stopPrice) || execPrice) : null;

  return (
    <>
    <Card className={`glass-card accent-border ${compact ? "" : "w-full max-w-sm"}`}>
      <CardHeader className={compact ? "p-4 pb-2" : ""}>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Trade {name} ({symbol})
        </CardTitle>
        <p className="text-2xl font-bold accent-gradient">{formatCurrency(price)}</p>
      </CardHeader>
      <CardContent className={compact ? "p-4 pt-0" : ""}>
        <div className="space-y-4">
          {/* Buy / Sell toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={side === "buy" ? "default" : "outline"}
              onClick={() => setSide("buy")}
              className={
                side === "buy"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-border hover:border-green-600/50"
              }
            >
              <ArrowUpCircle className="w-4 h-4 mr-1" />
              Buy
            </Button>
            <Button
              variant={side === "sell" ? "default" : "outline"}
              onClick={() => setSide("sell")}
              className={
                side === "sell"
                  ? "bg-[#E53E3E] hover:bg-red-700 text-white"
                  : "border-border hover:border-red-600/50"
              }
            >
              <ArrowDownCircle className="w-4 h-4 mr-1" />
              Sell
            </Button>
          </div>

          {/* Order type */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Order Type</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType((v as OrderType) ?? "market")}>
              <SelectTrigger className="bg-background/50 border-border h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market</SelectItem>
                <SelectItem value="limit">Limit</SelectItem>
                <SelectItem value="stop">Stop</SelectItem>
                <SelectItem value="stop-limit">Stop-Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quantity</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-background/50 border-border focus:border-[#00D4FF] h-10"
              min="0"
              step="any"
            />
          </div>

          {/* Limit price */}
          {showLimitInput && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Limit Price</Label>
              <Input
                type="number"
                placeholder={price.toFixed(2)}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                className="bg-background/50 border-border focus:border-[#00D4FF] h-10"
                min="0"
                step="any"
              />
            </div>
          )}

          {/* Stop price */}
          {showStopInput && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Stop Price</Label>
              <Input
                type="number"
                placeholder={price.toFixed(2)}
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className="bg-background/50 border-border focus:border-[#00D4FF] h-10"
                min="0"
                step="any"
              />
            </div>
          )}

          {/* Live preview */}
          {qty > 0 && (
            <div className="p-3 rounded-lg bg-background/60 border border-border space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(preview.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium">{formatCurrency(preview.fee)}</span>
              </div>
              <div className="border-t border-border my-1" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  {side === "buy" ? "Total Cost" : "Total Proceeds"}
                </span>
                <span className="font-semibold text-foreground">{formatCurrency(preview.total)}</span>
              </div>
              {profile && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Current Balance</span>
                    <span className="font-medium">{formatCurrency(profile.balance)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Balance After</span>
                    <span
                      className={`font-semibold ${
                        preview.balanceAfter >= 0 ? "text-foreground" : "text-[#E53E3E]"
                      }`}
                    >
                      {formatCurrency(preview.balanceAfter)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={loading || qty <= 0}
            className={`w-full h-11 font-semibold transition-all ${
              side === "buy"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-[#E53E3E] hover:bg-red-700 text-white"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `${side === "buy" ? "Buy" : "Sell"} ${symbol}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm {side === "buy" ? "Buy" : "Sell"} Order</DialogTitle>
          <DialogDescription>
            Review your order before confirming. This will execute immediately at market price.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Symbol</span>
            <span className="font-medium">{symbol}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Quantity</span>
            <span className="font-medium">{qty}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Price</span>
            <span className="font-medium">{formatCurrency(execPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(preview.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-medium">{formatCurrency(preview.fee)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-medium">{side === "buy" ? "Total Cost" : "Total Proceeds"}</span>
            <span className="font-semibold">{formatCurrency(preview.total)}</span>
          </div>
          {profile && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Balance After</span>
              <span className={preview.balanceAfter >= 0 ? "font-medium" : "font-medium text-[#E53E3E]"}>
                {formatCurrency(preview.balanceAfter)}
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={executeTrade}
            disabled={loading}
            className={side === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-[#E53E3E] hover:bg-red-700"}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
