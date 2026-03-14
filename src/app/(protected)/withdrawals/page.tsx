"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpCircle,
  Bitcoin,
  DollarSign,
  Building2,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function WithdrawalsPage() {
  const [method, setMethod] = useState<"btc" | "usdt" | "bank">("btc");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const { format: formatCurrency } = useCurrencyFormat();
  const { data: profile } = useProfile();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["withdrawal-requests"],
    queryFn: async () => {
      const res = await fetch("/api/withdrawals");
      if (!res.ok) return [];
      const data = await res.json();
      return data.requests ?? [];
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const balance = profile?.balance ?? 0;
    if (amt > balance) {
      toast.error("Insufficient balance");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Withdrawal request submitted. It is pending and will be released after review.");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
      setSubmitting(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpCircle className="w-6 h-6 text-[#00D4FF]" />
          Withdrawals
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Request a withdrawal from your account
        </p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Available Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold accent-gradient">{formatCurrency(profile?.balance ?? 0)}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          variant={method === "btc" ? "default" : "outline"}
          className={`h-auto py-4 ${method === "btc" ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40" : ""}`}
          onClick={() => setMethod("btc")}
        >
          <Bitcoin className="w-5 h-5 mr-2" />
          Bitcoin (BTC)
        </Button>
        <Button
          variant={method === "usdt" ? "default" : "outline"}
          className={`h-auto py-4 ${method === "usdt" ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40" : ""}`}
          onClick={() => setMethod("usdt")}
        >
          <DollarSign className="w-5 h-5 mr-2" />
          USDT
        </Button>
        <Button
          variant={method === "bank" ? "default" : "outline"}
          className={`h-auto py-4 ${method === "bank" ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40" : ""}`}
          onClick={() => setMethod("bank")}
        >
          <Building2 className="w-5 h-5 mr-2" />
          Bank Transfer
        </Button>
      </div>

      <Card className="glass-card accent-border">
        <CardHeader>
          <CardTitle className="text-base">Request Withdrawal</CardTitle>
          <p className="text-sm text-muted-foreground">
            {method === "bank"
              ? "Our finance department will be in touch to process your bank transfer."
              : `Withdraw via ${method === "btc" ? "Bitcoin" : "USDT"}. Funds will be released after admin approval.`}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                className="bg-background/50"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || !amount}
              className="w-full bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Withdrawal Request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Your Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !requests?.length ? (
            <p className="text-muted-foreground text-sm">No withdrawal requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r: { id: string; amount: number; method: string; status: string; created_at: string }) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border"
                >
                  <div>
                    <p className="font-medium">{formatCurrency(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.method.toUpperCase()} • {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "pending" && (
                      <>
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-amber-400">Pending</span>
                      </>
                    )}
                    {r.status === "approved" && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400">Approved</span>
                      </>
                    )}
                    {r.status === "rejected" && (
                      <>
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400">Rejected</span>
                      </>
                    )}
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
