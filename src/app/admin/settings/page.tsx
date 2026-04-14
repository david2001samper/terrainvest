"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Settings,
  Loader2,
  Shield,
  Megaphone,
  DollarSign,
  Wallet,
  FileText,
  Home,
  BookOpen,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

const CURRENCIES = ["EUR", "GBP", "CAD", "AUD"] as const;

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [defaultBalance, setDefaultBalance] = useState("10000000");
  const [feePerTrade, setFeePerTrade] = useState("0.10");
  const [announcement, setAnnouncement] = useState("");
  const [currencyRates, setCurrencyRates] = useState<Record<string, string>>({});
  const [walletBtc, setWalletBtc] = useState("");
  const [walletUsdt, setWalletUsdt] = useState("");
  const [paygateWallet, setPaygateWallet] = useState("");
  const [aboutUs, setAboutUs] = useState("");
  const [termsOfService, setTermsOfService] = useState("");
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [contactUs, setContactUs] = useState("");
  const [support, setSupport] = useState("");
  const [homeJourney, setHomeJourney] = useState("");
  const [homeMission, setHomeMission] = useState("");
  const [homeValues, setHomeValues] = useState("");
  const [homeCta, setHomeCta] = useState("");
  const [orderBookCacheMinutes, setOrderBookCacheMinutes] = useState("5");
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

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
      setWalletBtc(settings.wallet_btc ?? "");
      setWalletUsdt(settings.wallet_usdt ?? "");
      setPaygateWallet(settings.paygate_wallet ?? "");
      setAboutUs(settings.about_us ?? "");
      setTermsOfService(settings.terms_of_service ?? "");
      setPrivacyPolicy(settings.privacy_policy ?? "");
      setContactUs(settings.contact_us ?? "");
      setSupport(settings.support ?? "");
      setHomeJourney(settings.home_journey ?? "");
      setHomeMission(settings.home_mission ?? "");
      setHomeValues(settings.home_values ?? "");
      setHomeCta(settings.home_cta ?? "");
      setOrderBookCacheMinutes(settings.order_book_cache_minutes ?? "5");
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
          wallet_btc: walletBtc,
          wallet_usdt: walletUsdt,
          paygate_wallet: paygateWallet,
          about_us: aboutUs,
          terms_of_service: termsOfService,
          privacy_policy: privacyPolicy,
          contact_us: contactUs,
          support,
          home_journey: homeJourney,
          home_mission: homeMission,
          home_values: homeValues,
          home_cta: homeCta,
          order_book_cache_minutes: orderBookCacheMinutes,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-settings"] });
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

  async function handleChangeAdminPassword() {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPwd(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setChangingPwd(false);
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
              <BookOpen className="w-4 h-4 text-[#00D4FF]" />
              Order Book Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Cache Duration (minutes)</Label>
              <Input
                type="number"
                value={orderBookCacheMinutes}
                onChange={(e) => setOrderBookCacheMinutes(e.target.value)}
                className="bg-background/50"
                min="1"
                max="60"
                step="1"
              />
              <p className="text-xs text-muted-foreground">
                How often the order book data is refreshed from the market data provider.
                Higher values reduce API usage. Default: 5 minutes.
              </p>
            </div>
            <Button onClick={saveSettings} disabled={saving} variant="outline">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
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
              <Wallet className="w-4 h-4 text-amber-400" />
              Deposit Wallet Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Bitcoin (BTC) Address</Label>
              <Input
                value={walletBtc}
                onChange={(e) => setWalletBtc(e.target.value)}
                placeholder="bc1q..."
                className="bg-background/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">USDT (ERC-20) Address</Label>
              <Input
                value={walletUsdt}
                onChange={(e) => setWalletUsdt(e.target.value)}
                placeholder="0x..."
                className="bg-background/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">PayGate USDC (Polygon) Wallet</Label>
              <Input
                value={paygateWallet}
                onChange={(e) => setPaygateWallet(e.target.value)}
                placeholder="0x..."
                className="bg-background/50 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Used for card payment link generation via PayGate.to. Must start with 0x.
              </p>
            </div>
            <Button onClick={saveSettings} disabled={saving} variant="outline">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Wallets
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              Site Content (About, Terms, Privacy, etc.)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">About Us</Label>
              <Textarea
                value={aboutUs}
                onChange={(e) => setAboutUs(e.target.value)}
                placeholder="About Terra Invest VIP..."
                className="bg-background/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Terms of Service</Label>
              <Textarea
                value={termsOfService}
                onChange={(e) => setTermsOfService(e.target.value)}
                placeholder="Terms of service..."
                className="bg-background/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Privacy Policy</Label>
              <Textarea
                value={privacyPolicy}
                onChange={(e) => setPrivacyPolicy(e.target.value)}
                placeholder="Privacy policy..."
                className="bg-background/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Contact Us</Label>
              <Textarea
                value={contactUs}
                onChange={(e) => setContactUs(e.target.value)}
                placeholder="Contact information..."
                className="bg-background/50 min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Support</Label>
              <Textarea
                value={support}
                onChange={(e) => setSupport(e.target.value)}
                placeholder="Support information..."
                className="bg-background/50 min-h-[60px]"
              />
            </div>
            <Button onClick={saveSettings} disabled={saving} variant="outline">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Content
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="w-4 h-4 text-[#00D4FF]" />
              Home Page Sections (editable)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Our Journey</Label>
              <Textarea
                value={homeJourney}
                onChange={(e) => setHomeJourney(e.target.value)}
                placeholder="About our journey..."
                className="bg-background/50 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Our Mission</Label>
              <Textarea
                value={homeMission}
                onChange={(e) => setHomeMission(e.target.value)}
                placeholder="Our mission..."
                className="bg-background/50 min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Our Values</Label>
              <Input
                value={homeValues}
                onChange={(e) => setHomeValues(e.target.value)}
                placeholder="e.g. Integrity • Innovation • Excellence"
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Call to Action (bottom section)</Label>
              <Textarea
                value={homeCta}
                onChange={(e) => setHomeCta(e.target.value)}
                placeholder="Join thousands of investors..."
                className="bg-background/50 min-h-[60px]"
              />
            </div>
            <Button onClick={saveSettings} disabled={saving} variant="outline">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Home Content
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

        <Card className="glass-card accent-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#00D4FF]" />
              Change your password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Updates the password for the account you are signed in with. Use a strong password
              you do not reuse elsewhere.
            </p>
            <div className="space-y-2">
              <Label htmlFor="adminNewPassword" className="text-sm text-muted-foreground">
                New password
              </Label>
              <div className="relative max-w-sm">
                <Input
                  id="adminNewPassword"
                  type={showPwd ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="bg-background/50 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#00D4FF]"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminConfirmPassword" className="text-sm text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                id="adminConfirmPassword"
                type={showPwd ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="bg-background/50 max-w-sm"
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={handleChangeAdminPassword}
              disabled={changingPwd || !newPassword || !confirmPassword}
              className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
            >
              {changingPwd ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Update password
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
