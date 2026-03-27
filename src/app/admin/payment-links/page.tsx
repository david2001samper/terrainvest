"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Copy, Check, Loader2, ExternalLink } from "lucide-react";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

export default function PaymentLinksPage() {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [email, setEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setGenerating(true);
    setGeneratedUrl("");
    try {
      const res = await fetch("/api/admin/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, currency, email: email || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate link");
        return;
      }

      setGeneratedUrl(data.url);
      toast.success("Payment link generated");
    } catch {
      toast.error("Unexpected error");
    } finally {
      setGenerating(false);
    }
  }

  function copyUrl() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-[#00D4FF]" />
          Payment Links
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate card payment checkout links for clients
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card accent-border">
          <CardHeader>
            <CardTitle className="text-base">Generate Payment Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Amount</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                className="bg-background/50 h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v ?? "USD")}>
                <SelectTrigger className="bg-background/50 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Client Email <span className="text-muted-foreground/60">(optional)</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="bg-background/50 h-11"
              />
            </div>

            <Button
              onClick={generate}
              disabled={generating}
              className="w-full h-11 bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] hover:from-[#22D3EE] hover:to-[#00D4FF] text-[#0A0B0F] font-semibold"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Generate Link
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">Generated Link</CardTitle>
          </CardHeader>
          <CardContent>
            {generatedUrl ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-background/60 border border-border">
                  <code className="flex-1 text-sm break-all font-mono text-[#00D4FF]">
                    {generatedUrl}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={copyUrl}
                    className="shrink-0 mt-0.5"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyUrl}>
                    <Copy className="w-3.5 h-3.5 mr-2" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3.5 h-3.5 mr-2" />
                      Open
                    </Button>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with the client. They can pay with Visa, Mastercard, Apple Pay, or Google Pay.
                  Funds arrive as USDC in your configured wallet.
                </p>
              </div>
            ) : (
              <div className="py-12 text-center">
                <CreditCard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  Enter an amount and click Generate to create a payment link.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
