"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, Copy, Check, Bitcoin, DollarSign, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function DepositsPage() {
  const [method, setMethod] = useState<"btc" | "usdt" | "bank">("btc");
  const [copied, setCopied] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["deposit-settings"],
    queryFn: async () => {
      const res = await fetch("/api/platform/deposit-settings");
      if (!res.ok) return { wallet_btc: "", wallet_usdt: "" };
      return res.json();
    },
  });

  function copyAddress(addr: string, key: string) {
    navigator.clipboard.writeText(addr);
    setCopied(key);
    toast.success("Address copied");
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowDownCircle className="w-6 h-6 text-[#00D4FF]" />
          Deposits
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add funds to your account
        </p>
      </div>

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

      {method === "btc" && (
        <Card className="glass-card accent-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bitcoin className="w-5 h-5 text-amber-400" />
              Bitcoin (BTC) Deposit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : settings?.wallet_btc ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Send only BTC to this address:</p>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-background/60 border border-border">
                  <code className="flex-1 text-sm break-all font-mono">{settings.wallet_btc}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyAddress(settings.wallet_btc, "btc")}
                    className="shrink-0"
                  >
                    {copied === "btc" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Funds will be credited after network confirmation.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">BTC deposit is not configured. Contact support.</p>
            )}
          </CardContent>
        </Card>
      )}

      {method === "usdt" && (
        <Card className="glass-card accent-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              USDT Deposit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : settings?.wallet_usdt ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Send only USDT (ERC-20) to this address:</p>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-background/60 border border-border">
                  <code className="flex-1 text-sm break-all font-mono">{settings.wallet_usdt}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyAddress(settings.wallet_usdt, "usdt")}
                    className="shrink-0"
                  >
                    {copied === "usdt" ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Funds will be credited after network confirmation.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">USDT deposit is not configured. Contact support.</p>
            )}
          </CardContent>
        </Card>
      )}

      {method === "bank" && (
        <Card className="glass-card accent-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Bank Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Our finance department will be in touch to process your bank transfer request.
              Please contact support to initiate a deposit.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
