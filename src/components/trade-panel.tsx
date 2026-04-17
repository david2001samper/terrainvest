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
import { usePositions } from "@/hooks/use-positions";
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
  bid?: number;
  ask?: number;
  spreadPips?: number;
  assetType?: string;
  compact?: boolean;
}

type InputMode = "quantity" | "amount";

export function TradePanel({
  symbol,
  name,
  price,
  bid,
  ask,
  spreadPips,
  assetType,
  compact = false,
}: TradePanelProps) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState("");
  const [lots, setLots] = useState("0.01");
  const [dollarAmount, setDollarAmount] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("quantity");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [customPct, setCustomPct] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data: profile } = useProfile();
  const { data: positions } = usePositions();
  const isLocked = profile?.is_locked ?? false;
  const { format: formatCurrency } = useCurrencyFormat();
  const queryClient = useQueryClient();

  const ownedQty = positions?.find((p) => p.symbol === symbol)?.quantity ?? 0;
  const buyingPower = profile?.balance ?? 0;

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

  const midPrice = price;

  const execPrice =
    orderType === "market"
      ? midPrice
      : orderType === "limit"
      ? parseFloat(limitPrice) || midPrice
      : orderType === "stop"
      ? parseFloat(stopPrice) || midPrice
      : parseFloat(limitPrice) || midPrice;

  const forexUnits =
    assetType === "forex" ? (parseFloat(lots) || 0) * 100000 : 0;

  const qty =
    assetType === "forex"
      ? forexUnits
      : inputMode === "quantity"
      ? parseFloat(quantity) || 0
      : execPrice > 0
      ? Math.floor(((parseFloat(dollarAmount) || 0) / execPrice) * 100000) / 100000
      : 0;

  const isForex = assetType === "forex";
  const leverage = isForex ? (profile?.max_leverage ?? 1) : 1;

  const preview = useMemo(() => {
    const subtotal = qty * execPrice;
    const marginRequired = subtotal / leverage;
    const fee = qty > 0 ? feePerTrade : 0;
    const costBasis = side === "buy" ? marginRequired + fee : subtotal - fee;
    const balanceAfter =
      side === "buy"
        ? (profile?.balance ?? 0) - costBasis
        : (profile?.balance ?? 0) + subtotal - fee;
    return { subtotal, marginRequired, fee, total: costBasis, balanceAfter, leverage };
  }, [qty, execPrice, side, profile?.balance, feePerTrade, leverage]);

  function checkPermission(): boolean {
    if (!profile || !assetType) return true;
    const permMap: Record<string, keyof typeof profile> = {
      crypto: "can_trade_crypto",
      stock: "can_trade_stocks",
      index: "can_trade_indexes",
      commodity: "can_trade_commodities",
      forex: "can_trade_forex",
      options: "can_trade_options",
    };
    const field = permMap[assetType];
    if (field && profile[field] === false) {
      const label = assetType.charAt(0).toUpperCase() + assetType.slice(1);
      toast.error(`${label} trading is not enabled on your account. Contact your account manager.`);
      return false;
    }
    return true;
  }

  function checkMarketHours(): boolean {
    if (!assetType || assetType === "crypto") return true;
    const now = new Date();
    const utcDay = now.getUTCDay();
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();

    if (assetType === "forex") {
      if (utcDay === 6) { toast.error("Forex market is closed on Saturday."); return false; }
      if (utcDay === 0 && utcMins < 22 * 60) { toast.error("Forex market opens Sunday 5:00 PM ET."); return false; }
      if (utcDay === 5 && utcMins >= 22 * 60) { toast.error("Forex market closed. Opens Sunday 5:00 PM ET."); return false; }
      return true;
    }

    if (utcDay === 0 || utcDay === 6) { toast.error("Market is closed on weekends."); return false; }
    const etMins = ((utcMins - 4 * 60) + 1440) % 1440;
    if (etMins < 9 * 60 + 30) { toast.error("Market opens at 9:30 AM ET (pre-market)."); return false; }
    if (etMins >= 16 * 60) { toast.error("Market is closed (after hours)."); return false; }
    return true;
  }

  function handleSubmit() {
    if (qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!checkPermission()) return;
    if (!checkMarketHours()) return;
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
      setDollarAmount("");
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
        body: JSON.stringify({
          symbol,
          side,
          quantity: qty,
          lots: assetType === "forex" ? parseFloat(lots) || null : null,
          price: execPrice,
          asset_type: assetType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Trade failed");
        return;
      }
      toast.success(data.message);
      setConfirmOpen(false);
      setQuantity("");
      setDollarAmount("");
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
        <CardTitle className="text-sm font-medium text-foreground">
          Trade {name} ({symbol})
        </CardTitle>
        <p className="text-2xl font-bold accent-gradient">
          {formatCurrency(price)}
        </p>
        {isForex && bid != null && ask != null && (
          <p className="text-xs text-muted-foreground mt-1">
            Bid: <span className="text-foreground font-medium">{formatCurrency(bid, bid < 1 ? 6 : 4)}</span>{" "}
            · Ask: <span className="text-foreground font-medium">{formatCurrency(ask, ask < 1 ? 6 : 4)}</span>
            {spreadPips != null && (
              <>
                {" "}
                · Spread: <span className="text-foreground font-medium">{spreadPips.toFixed(1)} pips</span>
              </>
            )}
          </p>
        )}
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

          {/* Input mode toggle */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Input Mode</Label>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-background/50 border border-border rounded-lg">
              <button
                type="button"
                onClick={() => { setInputMode("quantity"); setDollarAmount(""); }}
                className={`text-xs py-1.5 rounded-md font-medium transition-all ${
                  inputMode === "quantity"
                    ? "bg-[#00D4FF]/15 text-[#00D4FF] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isForex ? "Lots" : "Quantity"}
              </button>
              <button
                type="button"
                onClick={() => { setInputMode("amount"); setQuantity(""); }}
                className={`text-xs py-1.5 rounded-md font-medium transition-all ${
                  inputMode === "amount"
                    ? "bg-[#00D4FF]/15 text-[#00D4FF] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isForex ? "Units" : "Amount ($)"}
              </button>
            </div>
          </div>

          {/* Quantity or Dollar Amount */}
          {inputMode === "quantity" ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {isForex ? "Lots (e.g. 0.01)" : "Quantity (shares/coins)"}
              </Label>
              <Input
                type="number"
                placeholder="0.00000"
                value={isForex ? lots : quantity}
                onChange={(e) => (isForex ? setLots(e.target.value) : setQuantity(e.target.value))}
                className="bg-background/50 border-border focus:border-[#00D4FF] h-10"
                min="0"
                step="any"
              />
              {isForex && (
                <p className="text-xs text-muted-foreground">
                  ≈ <span className="text-foreground font-medium">{Math.abs(qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> units
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {isForex ? "Units" : "Amount ($)"}
              </Label>
              <Input
                type="number"
                placeholder={isForex ? "e.g. 10000" : "e.g. 100.00"}
                value={isForex ? quantity : dollarAmount}
                onChange={(e) => (isForex ? setQuantity(e.target.value) : setDollarAmount(e.target.value))}
                className="bg-background/50 border-border focus:border-[#00D4FF] h-10"
                min="0"
                step={isForex ? "1" : "0.01"}
              />
              {qty > 0 && (
                <p className="text-xs text-muted-foreground">
                  {isForex ? (
                    <>
                      ≈ <span className="text-foreground font-medium">{(Math.abs(qty) / 100000).toFixed(2)}</span> lots
                    </>
                  ) : (
                    <>
                      ≈ <span className="text-foreground font-medium">{qty.toFixed(5)}</span> {symbol} @ {formatCurrency(execPrice)}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Quick % buttons */}
          {side === "buy" && buyingPower > 0 && !isForex && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                % of Buying Power ({formatCurrency(buyingPower)})
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setCustomPct(String(pct));
                      const amount = Math.floor(Math.max(0, buyingPower - 0.11) * (pct / 100) * 100) / 100;
                      const calcQty = execPrice > 0
                        ? Math.floor((amount / execPrice) * 100000) / 100000
                        : 0;
                      if (inputMode === "amount") setDollarAmount(amount.toFixed(2));
                      else setQuantity(calcQty.toString());
                    }}
                    className="text-[11px] py-1.5 rounded-md border border-green-600/30 text-green-400 hover:bg-green-600/10 font-medium transition-all"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  placeholder="Custom %"
                  value={customPct}
                  onChange={(e) => setCustomPct(e.target.value)}
                  className="bg-background/50 border-border focus:border-green-500 h-8 text-xs flex-1"
                  min="0"
                  max="100"
                  step="any"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs border-green-600/30 text-green-400 hover:bg-green-600/10"
                  onClick={() => {
                    const pct = parseFloat(customPct);
                    if (!pct || pct <= 0 || pct > 100) { toast.error("Enter 1–100%"); return; }
                    const amount = Math.floor(Math.max(0, buyingPower - 0.11) * (pct / 100) * 100) / 100;
                    const calcQty = execPrice > 0
                      ? Math.floor((amount / execPrice) * 100000) / 100000
                      : 0;
                    if (inputMode === "amount") setDollarAmount(amount.toFixed(2));
                    else setQuantity(calcQty.toString());
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          )}
          {side === "sell" && ownedQty > 0 && !isForex && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                % of Holdings ({ownedQty.toLocaleString(undefined, { maximumFractionDigits: 5 })} {symbol})
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setCustomPct(String(pct));
                      const sellQty = Math.floor(ownedQty * (pct / 100) * 100000) / 100000;
                      setInputMode("quantity");
                      setDollarAmount("");
                      setQuantity(sellQty.toString());
                    }}
                    className="text-[11px] py-1.5 rounded-md border border-red-600/30 text-red-400 hover:bg-red-600/10 font-medium transition-all"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  placeholder="Custom %"
                  value={customPct}
                  onChange={(e) => setCustomPct(e.target.value)}
                  className="bg-background/50 border-border focus:border-red-500 h-8 text-xs flex-1"
                  min="0"
                  max="100"
                  step="any"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs border-red-600/30 text-red-400 hover:bg-red-600/10"
                  onClick={() => {
                    const pct = parseFloat(customPct);
                    if (!pct || pct <= 0 || pct > 100) { toast.error("Enter 1–100%"); return; }
                    const sellQty = Math.floor(ownedQty * (pct / 100) * 100000) / 100000;
                    setInputMode("quantity");
                    setDollarAmount("");
                    setQuantity(sellQty.toString());
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          )}

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
                <span className="text-muted-foreground">Notional Value</span>
                <span className="font-medium">{formatCurrency(preview.subtotal)}</span>
              </div>
              {isForex && leverage > 1 && side === "buy" && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Leverage</span>
                  <span className="font-medium text-[#00D4FF]">1:{leverage}</span>
                </div>
              )}
              {isForex && leverage > 1 && side === "buy" && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Margin Required</span>
                  <span className="font-medium">{formatCurrency(preview.marginRequired)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium">{formatCurrency(preview.fee)}</span>
              </div>
              <div className="border-t border-border my-1" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">
                  {side === "buy" ? (isForex && leverage > 1 ? "Margin + Fee" : "Total Cost") : "Total Proceeds"}
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

          {isLocked && (
            <p className="text-sm text-amber-400">Your account is locked. Contact support.</p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={loading || qty <= 0 || isLocked}
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
            <span className="font-medium">{qty.toFixed(5)}</span>
          </div>
          {inputMode === "amount" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dollar Amount</span>
              <span className="font-medium">{formatCurrency(parseFloat(dollarAmount) || 0)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Est. Price</span>
            <span className="font-medium">{formatCurrency(execPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Notional Value</span>
            <span className="font-medium">{formatCurrency(preview.subtotal)}</span>
          </div>
          {isForex && leverage > 1 && side === "buy" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Leverage</span>
              <span className="font-medium text-[#00D4FF]">1:{leverage}</span>
            </div>
          )}
          {isForex && leverage > 1 && side === "buy" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margin Required</span>
              <span className="font-medium">{formatCurrency(preview.marginRequired)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-medium">{formatCurrency(preview.fee)}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between">
            <span className="font-medium">{side === "buy" ? (isForex && leverage > 1 ? "Margin + Fee" : "Total Cost") : "Total Proceeds"}</span>
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
