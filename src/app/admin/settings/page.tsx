"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Settings, Loader2, Shield, Megaphone, DollarSign } from "lucide-react";

const CURRENCIES = ["EUR", "GBP", "CAD", "AUD"] as const;

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [defaultBalance, setDefaultBalance] = useState("10000000");
  const [feePerTrade, setFeePerTrade] = useState("0.10");
  const [announcement, setAnnouncement] = useState("");
  const [currencyRates, setCurrencyRates] = useState<Record<string, string>>({});
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setDefaultBalance(settings.default_balance ?? "10000000");
      setFeePerTrade(settings.fee_per_trade ?? "0.10");
      setAnnouncement(settings.announcement ?? "");
      if (settings.currency_rates) {
        const rates: Record<string, string> = {};
        for (const c of CURRENCIES) {
          rates[c] = String(settings.currency_rates[c] ?? "");
        }
        setCurrencyRates(rates);
      }
    }
  }, [settings]);

  async function saveSettings() {
    setSaving(true);
    try {
      const rates: Record<string, number> = {};
      for (const c of CURRENCIES) {
        const v = parseFloat(currencyRates[c]);
        if (!isNaN(v) && v > 0) rates[c] = v;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_balance: defaultBalance,
          fee_per_trade: feePerTrade,
          announcement,
          currency_rates: Object.keys(rates).length ? rates : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "settings"] });
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function seedAdmin() {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Seed failed");
        return;
      }
      toast.success(data.message);
    } catch {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-muted-foreground" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Global configuration for Terra Invest VIP
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card accent-border">
          <CardHeader>
            <CardTitle className="text-base">Default New User Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Starting Balance (USD)</Label>
              <Input
                type="number"
                value={defaultBalance}
                onChange={(e) => setDefaultBalance(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Fee Per Trade (USD)</Label>
              <Input
                type="number"
                value={feePerTrade}
                onChange={(e) => setFeePerTrade(e.target.value)}
                className="bg-background/50"
                step="0.01"
                min="0"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Starting balance for new users. Set to 0 for no starting balance. Requires{" "}
              <code className="text-[10px] bg-muted px-1 rounded">supabase-migration-default-balance.sql</code>{" "}
              to be run in Supabase SQL Editor (one-time).
            </p>
            <Button
              onClick={saveSettings}
              disabled={saving}
              className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Settings
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              Currency Rates (1 USD = X)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Exchange rates for displaying amounts. Users see values converted from USD.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CURRENCIES.map((c) => (
                <div key={c} className="space-y-1">
                  <Label className="text-xs">USD → {c}</Label>
                  <Input
                    type="number"
                    value={currencyRates[c] ?? ""}
                    onChange={(e) => setCurrencyRates((prev) => ({ ...prev, [c]: e.target.value }))}
                    placeholder={c === "EUR" ? "0.92" : c === "GBP" ? "0.79" : c === "CAD" ? "1.35" : "1.53"}
                    step="0.01"
                    min="0"
                    className="bg-background/50"
                  />
                </div>
              ))}
            </div>
            <Button onClick={saveSettings} disabled={saving} variant="outline">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Rates
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-400" />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Platform Announcement</Label>
              <Textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Broadcast a message to all users..."
                className="bg-background/50 min-h-[100px]"
              />
            </div>
            <Button
              onClick={saveSettings}
              disabled={saving}
              variant="outline"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              Admin Account Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create or verify the default admin account. This will create{" "}
              <span className="text-foreground font-medium">admin@terrainvestvip.com</span>{" "}
              with password <span className="text-foreground font-medium">admin123</span>.
            </p>
            <Button
              onClick={seedAdmin}
              disabled={seeding}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              {seeding ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Create Admin Account
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Platform Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-background/50">
              <p className="text-xs text-muted-foreground mb-1">Platform</p>
              <p className="font-medium">Terra Invest VIP</p>
            </div>
            <div className="p-4 rounded-lg bg-background/50">
              <p className="text-xs text-muted-foreground mb-1">Version</p>
              <p className="font-medium">1.0.0</p>
            </div>
            <div className="p-4 rounded-lg bg-background/50">
              <p className="text-xs text-muted-foreground mb-1">Environment</p>
              <p className="font-medium">Production</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
