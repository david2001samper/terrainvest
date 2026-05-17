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
  Phone,
  Globe,
  Paintbrush,
  Mail,
} from "lucide-react";
import { BRANDING_DEFAULTS } from "@/lib/platform-config";

const CURRENCIES = ["EUR", "GBP", "CAD", "AUD"] as const;

function colorInputValue(value: string, fallback: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "branding", label: "Branding", icon: Paintbrush },
  { id: "content", label: "Site Content", icon: FileText },
  { id: "homepage", label: "Home Page", icon: Home },
  { id: "contact", label: "Contact Info", icon: Phone },
  { id: "wallets", label: "Wallets & Deposits", icon: Wallet },
  { id: "admin", label: "Admin & Security", icon: Shield },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("general");

  const [defaultBalance, setDefaultBalance] = useState("0");
  const [feePerTrade, setFeePerTrade] = useState("0.10");
  const [announcement, setAnnouncement] = useState("");
  const [currencyRates, setCurrencyRates] = useState<Record<string, string>>({});
  const [orderBookCacheMinutes, setOrderBookCacheMinutes] = useState("5");

  const [walletBtc, setWalletBtc] = useState("");
  const [walletUsdt, setWalletUsdt] = useState("");

  const [aboutUs, setAboutUs] = useState("");
  const [termsOfService, setTermsOfService] = useState("");
  const [privacyPolicy, setPrivacyPolicy] = useState("");
  const [contactUs, setContactUs] = useState("");
  const [supportPage, setSupportPage] = useState("");
  const [journeyPage, setJourneyPage] = useState("");
  const [ourHistory, setOurHistory] = useState("");
  const [tradingApproach, setTradingApproach] = useState("");
  const [accountManagement, setAccountManagement] = useState("");

  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [homeJourney, setHomeJourney] = useState("");
  const [homeMission, setHomeMission] = useState("");
  const [homeValues, setHomeValues] = useState("");
  const [homeCta, setHomeCta] = useState("");

  const [platformName, setPlatformName] = useState(BRANDING_DEFAULTS.platform_name);
  const [platformShortName, setPlatformShortName] = useState(BRANDING_DEFAULTS.platform_short_name);
  const [platformTagline, setPlatformTagline] = useState(BRANDING_DEFAULTS.platform_tagline);
  const [platformLogoUrl, setPlatformLogoUrl] = useState(BRANDING_DEFAULTS.platform_logo_url);
  const [primaryBrandColor, setPrimaryBrandColor] = useState(BRANDING_DEFAULTS.primary_brand_color);
  const [secondaryBrandColor, setSecondaryBrandColor] = useState(BRANDING_DEFAULTS.secondary_brand_color);
  const [platformDomain, setPlatformDomain] = useState(BRANDING_DEFAULTS.platform_domain);
  const [platformFooterDomain, setPlatformFooterDomain] = useState(BRANDING_DEFAULTS.platform_footer_domain);
  const [brandAdminEmail, setBrandAdminEmail] = useState(BRANDING_DEFAULTS.admin_email);
  const [emailFromName, setEmailFromName] = useState(BRANDING_DEFAULTS.email_from_name);
  const [emailFromAddress, setEmailFromAddress] = useState(BRANDING_DEFAULTS.email_from_address);
  const [adminAlertEmail, setAdminAlertEmail] = useState(BRANDING_DEFAULTS.admin_alert_email);
  const [emailProvider, setEmailProvider] = useState("resend");
  const [leadAllowedOrigins, setLeadAllowedOrigins] = useState("");
  const [approvalTimeText, setApprovalTimeText] = useState(BRANDING_DEFAULTS.approval_time_text);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [signupApprovalEnabled, setSignupApprovalEnabled] = useState(false);

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
      setDefaultBalance(settings.default_balance ?? "0");
      setFeePerTrade(settings.fee_per_trade ?? "0.10");
      setAnnouncement(settings.announcement ?? "");
      setOrderBookCacheMinutes(settings.order_book_cache_minutes ?? "5");
      setWalletBtc(settings.wallet_btc ?? "");
      setWalletUsdt(settings.wallet_usdt ?? "");
      setAboutUs(settings.about_us ?? "");
      setTermsOfService(settings.terms_of_service ?? "");
      setPrivacyPolicy(settings.privacy_policy ?? "");
      setContactUs(settings.contact_us ?? "");
      setSupportPage(settings.support ?? "");
      setJourneyPage(settings.journey ?? "");
      setOurHistory(settings.our_history ?? "");
      setTradingApproach(settings.trading_approach ?? "");
      setAccountManagement(settings.account_management ?? "");
      setContactPhone(settings.contact_phone ?? "");
      setContactEmail(settings.contact_email ?? "");
      setHomeJourney(settings.home_journey ?? "");
      setHomeMission(settings.home_mission ?? "");
      setHomeValues(settings.home_values ?? "");
      setHomeCta(settings.home_cta ?? "");
      setPlatformName(settings.platform_name ?? BRANDING_DEFAULTS.platform_name);
      setPlatformShortName(settings.platform_short_name ?? BRANDING_DEFAULTS.platform_short_name);
      setPlatformTagline(settings.platform_tagline ?? BRANDING_DEFAULTS.platform_tagline);
      setPlatformLogoUrl(settings.platform_logo_url ?? BRANDING_DEFAULTS.platform_logo_url);
      setPrimaryBrandColor(settings.primary_brand_color ?? BRANDING_DEFAULTS.primary_brand_color);
      setSecondaryBrandColor(settings.secondary_brand_color ?? BRANDING_DEFAULTS.secondary_brand_color);
      setPlatformDomain(settings.platform_domain ?? BRANDING_DEFAULTS.platform_domain);
      setPlatformFooterDomain(settings.platform_footer_domain ?? BRANDING_DEFAULTS.platform_footer_domain);
      setBrandAdminEmail(settings.admin_email ?? BRANDING_DEFAULTS.admin_email);
      setEmailFromName(settings.email_from_name ?? BRANDING_DEFAULTS.email_from_name);
      setEmailFromAddress(settings.email_from_address ?? BRANDING_DEFAULTS.email_from_address);
      setAdminAlertEmail(settings.admin_alert_email ?? BRANDING_DEFAULTS.admin_alert_email);
      setEmailProvider(settings.email_provider ?? "resend");
      setLeadAllowedOrigins(settings.lead_allowed_origins ?? "");
      setApprovalTimeText(settings.approval_time_text ?? BRANDING_DEFAULTS.approval_time_text);
      setEmailEnabled(settings.email_enabled === "true");
      setSignupApprovalEnabled(settings.signup_approval_enabled === "true");
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
          about_us: aboutUs,
          terms_of_service: termsOfService,
          privacy_policy: privacyPolicy,
          contact_us: contactUs,
          support: supportPage,
          journey: journeyPage,
          our_history: ourHistory,
          trading_approach: tradingApproach,
          account_management: accountManagement,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          home_journey: homeJourney,
          home_mission: homeMission,
          home_values: homeValues,
          home_cta: homeCta,
          order_book_cache_minutes: orderBookCacheMinutes,
          platform_name: platformName,
          platform_short_name: platformShortName,
          platform_tagline: platformTagline,
          platform_logo_url: platformLogoUrl,
          primary_brand_color: primaryBrandColor,
          secondary_brand_color: secondaryBrandColor,
          platform_domain: platformDomain,
          platform_footer_domain: platformFooterDomain,
          admin_email: brandAdminEmail,
          email_from_name: emailFromName,
          email_from_address: emailFromAddress,
          admin_alert_email: adminAlertEmail,
          email_provider: emailProvider,
          lead_allowed_origins: leadAllowedOrigins,
          approval_time_text: approvalTimeText,
          email_enabled: emailEnabled ? "true" : "false",
          signup_approval_enabled: signupApprovalEnabled ? "true" : "false",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["deposit-settings"] });
      queryClient.invalidateQueries({ queryKey: ["platform-branding"] });
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

  const SaveButton = ({ label = "Save Changes" }: { label?: string }) => (
    <Button
      onClick={saveSettings}
      disabled={saving}
      className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
      {label}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-muted-foreground" />
          Platform Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Global configuration for your platform
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-card/60 border border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/25"
                : "text-muted-foreground hover:text-foreground hover:bg-card/80 border border-transparent"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============= GENERAL ============= */}
      {activeTab === "general" && (
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
                Starting balance for new users. Set to 0 for no starting balance.
              </p>
              <SaveButton />
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
                  How often the order book data is refreshed. Default: 5 minutes.
                </p>
              </div>
              <SaveButton label="Save" />
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
              <SaveButton label="Save Rates" />
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
              <SaveButton label="Save" />
            </CardContent>
          </Card>

          <Card className="glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Platform Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-background/50">
                  <p className="text-xs text-muted-foreground mb-1">Platform</p>
                  <p className="font-medium">{platformName}</p>
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
      )}

      {/* ============= BRANDING ============= */}
      {activeTab === "branding" && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            White-label your platform. These values are used across the entire site — headers, footers, emails, and exports.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card accent-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Paintbrush className="w-4 h-4 text-[#00D4FF]" />
                  Platform Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Platform Name</Label>
                  <Input
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="Terra Invest VIP"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Full brand name shown in headers, footer, login, signup, emails, and exports.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Short Name</Label>
                  <Input
                    value={platformShortName}
                    onChange={(e) => setPlatformShortName(e.target.value)}
                    placeholder="Terra Invest"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Shorter version used in compact spaces (sidebar, mobile nav).</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Tagline</Label>
                  <Input
                    value={platformTagline}
                    onChange={(e) => setPlatformTagline(e.target.value)}
                    placeholder="Premium Trading Platform"
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Domain</Label>
                  <Input
                    value={platformDomain}
                    onChange={(e) => setPlatformDomain(e.target.value)}
                    placeholder="terrainvest.vip"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Main app domain used for email links and redirects.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Footer Domain</Label>
                  <Input
                    value={platformFooterDomain}
                    onChange={(e) => setPlatformFooterDomain(e.target.value)}
                    placeholder="terrainvest.vip"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Domain text shown in public footers and email footers.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Logo URL</Label>
                  <Input
                    value={platformLogoUrl}
                    onChange={(e) => setPlatformLogoUrl(e.target.value)}
                    placeholder="/logo.png or https://example.com/logo.png"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Use a local path like /logo.png or a full HTTPS image URL.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Primary Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorInputValue(primaryBrandColor, BRANDING_DEFAULTS.primary_brand_color)}
                        onChange={(e) => setPrimaryBrandColor(e.target.value)}
                        className="h-10 w-14 bg-background/50 p-1"
                      />
                      <Input
                        value={primaryBrandColor}
                        onChange={(e) => setPrimaryBrandColor(e.target.value)}
                        placeholder="#00D4FF"
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Secondary Brand Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={colorInputValue(secondaryBrandColor, BRANDING_DEFAULTS.secondary_brand_color)}
                        onChange={(e) => setSecondaryBrandColor(e.target.value)}
                        className="h-10 w-14 bg-background/50 p-1"
                      />
                      <Input
                        value={secondaryBrandColor}
                        onChange={(e) => setSecondaryBrandColor(e.target.value)}
                        placeholder="#0EA5E9"
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-400" />
                  Email Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3">
                  <div>
                    <p className="text-sm font-medium">Enable Email Notifications</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Send transactional emails for signups, approvals, deposits, and withdrawals.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={emailEnabled}
                    onClick={() => setEmailEnabled((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      emailEnabled ? "bg-[#00D4FF]" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        emailEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {!emailEnabled && (
                  <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    Email sending is currently disabled. Enable it above and make sure RESEND_API_KEY is set in your environment.
                  </p>
                )}
                <div className="rounded-lg border border-border bg-background/50 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Email Provider Status</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Resend is used for sending today. SMTP status is shown for white-label deployment readiness.
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        settings?.email_status?.resend_configured
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {settings?.email_status?.resend_configured ? "Resend configured" : "Resend missing"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Provider</p>
                      <p className="font-medium uppercase">{settings?.email_status?.provider ?? emailProvider}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Resend API Key</p>
                      <p className="font-medium">{settings?.email_status?.resend_configured ? "Configured" : "Not configured"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SMTP Env</p>
                      <p className="font-medium">{settings?.email_status?.smtp_configured ? "Configured" : "Not configured"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email Provider</Label>
                  <Input
                    value={emailProvider}
                    onChange={(e) => setEmailProvider(e.target.value)}
                    placeholder="resend"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Current supported sender is Resend. SMTP can be configured later without changing the settings model.</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3">
                  <div>
                    <p className="text-sm font-medium">Require Admin Approval for Signup</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When enabled, new users must be approved before they can access the platform.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={signupApprovalEnabled}
                    onClick={() => setSignupApprovalEnabled((v) => !v)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      signupApprovalEnabled ? "bg-[#00D4FF]" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        signupApprovalEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {!signupApprovalEnabled && (
                  <p className="text-xs text-green-400/80 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    Signup approval is currently disabled. New users are auto-approved by default.
                  </p>
                )}
                <div className="space-y-2">
                  <Label className="text-sm">Admin Email</Label>
                  <Input
                    type="email"
                    value={brandAdminEmail}
                    onChange={(e) => setBrandAdminEmail(e.target.value)}
                    placeholder="admin@terrainvestvip.com"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">The admin account email. Used in the DB trigger for auto-approval.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email From Name</Label>
                  <Input
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    placeholder="Terra Invest VIP"
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Email From Address</Label>
                  <Input
                    type="email"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    placeholder="support@terrainvestvip.com"
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Admin Alert Email</Label>
                  <Input
                    type="email"
                    value={adminAlertEmail}
                    onChange={(e) => setAdminAlertEmail(e.target.value)}
                    placeholder="admin@terrainvestvip.com"
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground">Receives new signup / withdrawal alerts.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Lead Allowed Origins</Label>
                  <Textarea
                    value={leadAllowedOrigins}
                    onChange={(e) => setLeadAllowedOrigins(e.target.value)}
                    placeholder="https://example.com, https://second-domain.com"
                    className="bg-background/50 min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated domains allowed to submit leads into this admin panel.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Approval Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Pending Approval Text</Label>
                  <Textarea
                    value={approvalTimeText}
                    onChange={(e) => setApprovalTimeText(e.target.value)}
                    placeholder="Approval usually takes 10 minutes to 1 hour..."
                    className="bg-background/50 min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">Shown to new users on the pending-approval screen after signup.</p>
                </div>
                <SaveButton label="Save Branding" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ============= SITE CONTENT ============= */}
      {activeTab === "content" && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Edit the content that appears on your public-facing pages. Changes take effect within 60 seconds.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { label: "About Us", value: aboutUs, setter: setAboutUs, placeholder: "About Terra Invest VIP..." },
              { label: "Our Journey", value: journeyPage, setter: setJourneyPage, placeholder: "Public journey page content..." },
              { label: "Our History", value: ourHistory, setter: setOurHistory, placeholder: "Company history and background..." },
              { label: "Trading Approach", value: tradingApproach, setter: setTradingApproach, placeholder: "How trade signals and risk parameters work..." },
              { label: "Account Management", value: accountManagement, setter: setAccountManagement, placeholder: "Dedicated account manager and client support..." },
              { label: "Contact Us Page", value: contactUs, setter: setContactUs, placeholder: "Contact information page content..." },
              { label: "Support Page", value: supportPage, setter: setSupportPage, placeholder: "Support information page content..." },
              { label: "Terms of Service", value: termsOfService, setter: setTermsOfService, placeholder: "Terms of service..." },
              { label: "Privacy Policy", value: privacyPolicy, setter: setPrivacyPolicy, placeholder: "Privacy policy..." },
            ].map((field) => (
              <Card key={field.label} className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    {field.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    className="bg-background/50 min-h-[120px] text-sm"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
          <SaveButton label="Save All Content" />
        </div>
      )}

      {/* ============= HOME PAGE ============= */}
      {activeTab === "homepage" && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Edit the sections that appear on your landing page. These are separate from the public content pages.
          </p>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="w-4 h-4 text-[#00D4FF]" />
                Home Page Sections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm">Our Journey (homepage card)</Label>
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
              <SaveButton label="Save Home Content" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============= CONTACT INFO ============= */}
      {activeTab === "contact" && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Phone and email shown on the homepage, content pages, and footer. Changing these updates every page.
          </p>
          <Card className="glass-card accent-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#00D4FF]" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm">Phone Number</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+16478007539"
                  className="bg-background/50 max-w-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Include country code. Displayed on the homepage hero, navbar, footer, and content pages.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Email Address</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="support@terrainvestvip.com"
                  className="bg-background/50 max-w-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Primary support/contact email shown site-wide.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Preview</Label>
                <div className="rounded-xl border border-border bg-background/50 p-4 max-w-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-[#00D4FF]" />
                    <span className="text-sm font-medium">{contactPhone || "+16478007539"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#00D4FF]" />
                    <span className="text-sm">{contactEmail || "support@terrainvestvip.com"}</span>
                  </div>
                </div>
              </div>
              <SaveButton label="Save Contact Info" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============= WALLETS & DEPOSITS ============= */}
      {activeTab === "wallets" && (
        <div className="space-y-6">
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
              <SaveButton label="Save Wallets" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============= ADMIN & SECURITY ============= */}
      {activeTab === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" />
                Admin Account Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create or verify the configured admin account. This will create{" "}
                <span className="text-foreground font-medium">{brandAdminEmail}</span>{" "}
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
      )}
    </div>
  );
}
