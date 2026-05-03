"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle,
  Loader2,
  Send,
  ChevronDown,
  ShieldCheck,
  TrendingUp,
  Users,
  Globe,
  Star,
  ArrowRight,
  Lock,
  Home,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const COUNTRY_CODES = [
  { code: "+1",   flag: "🇺🇸", label: "+1",   country: "US/CA" },
  { code: "+44",  flag: "🇬🇧", label: "+44",  country: "UK" },
  { code: "+49",  flag: "🇩🇪", label: "+49",  country: "DE" },
  { code: "+33",  flag: "🇫🇷", label: "+33",  country: "FR" },
  { code: "+39",  flag: "🇮🇹", label: "+39",  country: "IT" },
  { code: "+34",  flag: "🇪🇸", label: "+34",  country: "ES" },
  { code: "+31",  flag: "🇳🇱", label: "+31",  country: "NL" },
  { code: "+41",  flag: "🇨🇭", label: "+41",  country: "CH" },
  { code: "+43",  flag: "🇦🇹", label: "+43",  country: "AT" },
  { code: "+61",  flag: "🇦🇺", label: "+61",  country: "AU" },
  { code: "+64",  flag: "🇳🇿", label: "+64",  country: "NZ" },
  { code: "+971", flag: "🇦🇪", label: "+971", country: "UAE" },
  { code: "+966", flag: "🇸🇦", label: "+966", country: "SA" },
  { code: "+65",  flag: "🇸🇬", label: "+65",  country: "SG" },
  { code: "+852", flag: "🇭🇰", label: "+852", country: "HK" },
  { code: "+81",  flag: "🇯🇵", label: "+81",  country: "JP" },
  { code: "+82",  flag: "🇰🇷", label: "+82",  country: "KR" },
  { code: "+91",  flag: "🇮🇳", label: "+91",  country: "IN" },
  { code: "+55",  flag: "🇧🇷", label: "+55",  country: "BR" },
  { code: "+52",  flag: "🇲🇽", label: "+52",  country: "MX" },
  { code: "+27",  flag: "🇿🇦", label: "+27",  country: "ZA" },
  { code: "+20",  flag: "🇪🇬", label: "+20",  country: "EG" },
  { code: "+90",  flag: "🇹🇷", label: "+90",  country: "TR" },
  { code: "+7",   flag: "🇷🇺", label: "+7",   country: "RU" },
  { code: "+48",  flag: "🇵🇱", label: "+48",  country: "PL" },
  { code: "+46",  flag: "🇸🇪", label: "+46",  country: "SE" },
  { code: "+47",  flag: "🇳🇴", label: "+47",  country: "NO" },
  { code: "+45",  flag: "🇩🇰", label: "+45",  country: "DK" },
  { code: "+358", flag: "🇫🇮", label: "+358", country: "FI" },
  { code: "+351", flag: "🇵🇹", label: "+351", country: "PT" },
  { code: "+30",  flag: "🇬🇷", label: "+30",  country: "GR" },
  { code: "+32",  flag: "🇧🇪", label: "+32",  country: "BE" },
  { code: "+972", flag: "🇮🇱", label: "+972", country: "IL" },
  { code: "+60",  flag: "🇲🇾", label: "+60",  country: "MY" },
  { code: "+66",  flag: "🇹🇭", label: "+66",  country: "TH" },
  { code: "+54",  flag: "🇦🇷", label: "+54",  country: "AR" },
  { code: "+56",  flag: "🇨🇱", label: "+56",  country: "CL" },
  { code: "+57",  flag: "🇨🇴", label: "+57",  country: "CO" },
];

const INVESTMENT_RANGES = [
  { value: "under_10k",  label: "Under $10,000" },
  { value: "10k_50k",    label: "$10,000 – $50,000" },
  { value: "50k_100k",   label: "$50,000 – $100,000" },
  { value: "100k_250k",  label: "$100,000 – $250,000" },
  { value: "250k_500k",  label: "$250,000 – $500,000" },
  { value: "500k_plus",  label: "$500,000+" },
];

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "Bank-Grade Security" },
  { icon: Lock,        label: "End-to-End Encrypted" },
  { icon: Globe,       label: "Global Markets Access" },
];

const STATS = [
  { value: "500+",  label: "Active VIP Clients" },
  { value: "150+",  label: "Global Markets" },
  { value: "24/7",  label: "Dedicated Support" },
];

export default function LandingPage() {
  const [fullName,        setFullName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [countryCode,     setCountryCode]     = useState("+1");
  const [phone,           setPhone]           = useState("");
  const [country,         setCountry]         = useState("");
  const [investmentRange, setInvestmentRange] = useState("");
  const [notes,           setNotes]           = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [submitted,       setSubmitted]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Please enter your name and email");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name:        fullName,
          email,
          phone:            phone ? `${countryCode} ${phone}` : null,
          country_code:     countryCode,
          country:          country || null,
          investment_range: investmentRange || null,
          message:          notes || null,
          source:           "dedicated_landing",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen vip-gradient-bg relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#00D4FF]/6 rounded-full blur-[180px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-[#0EA5E9]/5 rounded-full blur-[140px]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-6 lg:px-14 py-5 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Image src="/logo.png" alt="Terra Invest VIP" width={40} height={40} className="object-contain" priority />
          <div>
            <p className="text-sm font-bold leading-tight">Terra Invest VIP</p>
            <p className="text-[10px] text-[#00D4FF] font-medium tracking-wide uppercase">
              Private Trading Platform
            </p>
          </div>
        </Link>
        <div className="flex flex-col items-stretch sm:items-end gap-3">
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-[#00D4FF]/30 transition-colors"
            >
              <Home className="w-4 h-4 shrink-0" aria-hidden />
              Home
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center h-9 px-3 rounded-md text-sm font-medium border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-[#00D4FF]/30 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <div className="hidden sm:flex flex-wrap items-center justify-end gap-1.5">
            {TRUST_BADGES.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border text-[11px] text-muted-foreground"
              >
                <b.icon className="w-3 h-3 text-[#00D4FF]" />
                {b.label}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-6 lg:px-14 pt-8 pb-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-start">

          {/* ─── Left: pitch copy ─────────────────────────────────────── */}
          <div id="landing-pitch" className="lg:pt-6 scroll-mt-24">
            {/* Label */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/25 mb-6">
              <Star className="w-3 h-3 text-[#00D4FF] fill-[#00D4FF]" />
              <span className="text-xs font-semibold text-[#00D4FF] tracking-wide">
                Exclusive VIP Access
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold leading-[1.1] mb-6">
              Trade smarter.<br />
              <span className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] bg-clip-text text-transparent">
                Grow faster.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">
              Join a private network of high-net-worth investors with access to real-time global markets,
              institutional-grade tools, and a dedicated account manager.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-xl bg-card/60 border border-border p-4 text-center">
                  <p className="text-2xl font-bold text-[#00D4FF]">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                { icon: TrendingUp, title: "Real-Time Global Markets",    desc: "Crypto, stocks, indexes, commodities & forex in one platform." },
                { icon: Users,      title: "Dedicated Account Manager",   desc: "Personal specialist who knows your portfolio and goals." },
                { icon: ShieldCheck,title: "Bank-Grade Security",         desc: "Enterprise encryption and multi-factor authentication." },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3.5 p-4 rounded-xl bg-card/40 border border-border">
                  <div className="w-9 h-9 rounded-xl bg-[#00D4FF]/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-4 h-4 text-[#00D4FF]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* ─── Right: form ──────────────────────────────────────────── */}
          <div>
            <div className="rounded-2xl bg-card/70 border border-border backdrop-blur-sm p-7 sm:p-8 shadow-2xl relative overflow-hidden">
              {/* Card glow */}
              <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 bg-[#00D4FF]/6 rounded-full blur-[80px]" />

              {submitted ? (
                /* ── Success state ── */
                <div className="relative z-10 py-10 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center mb-6">
                    <CheckCircle className="w-10 h-10 text-[#00D4FF]" />
                  </div>
                  <h2 className="text-2xl font-bold mb-3">You&apos;re on the list!</h2>
                  <p className="text-muted-foreground leading-relaxed max-w-xs">
                    Thank you for your interest. One of our account managers will reach out within 24 hours.
                  </p>
                  <div className="mt-8 grid grid-cols-3 gap-3 w-full">
                    {STATS.map((s) => (
                      <div key={s.label} className="rounded-xl bg-background/50 border border-border p-3 text-center">
                        <p className="text-lg font-bold text-[#00D4FF]">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
                    <Link
                      href="/"
                      className="inline-flex flex-1 items-center justify-center h-11 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold text-sm hover:from-[#22D3EE] hover:to-[#00D4FF] transition-all shadow-lg shadow-[#00D4FF]/20"
                    >
                      Home
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11 border-border bg-background/50 hover:bg-background/80"
                      onClick={() => {
                        document.getElementById("landing-pitch")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }}
                    >
                      Explore this page
                    </Button>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Ready to trade?{" "}
                    <Link href="/auth/signup" className="text-[#00D4FF] hover:underline font-medium">
                      Create an account
                    </Link>
                  </p>
                </div>
              ) : (
                /* ── Form ── */
                <div className="relative z-10">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold">Request Private Access</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Fill in your details and we&apos;ll be in touch shortly.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Full Name <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="text"
                          placeholder="Jane Smith"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          className="bg-background/50 border-border focus:border-[#00D4FF] h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Email <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          type="email"
                          placeholder="jane@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="bg-background/50 border-border focus:border-[#00D4FF] h-11"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Phone Number
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative shrink-0">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="h-11 rounded-md border border-border bg-background/50 pl-3 pr-7 text-sm appearance-none focus:border-[#00D4FF] focus:outline-none w-[100px]"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.flag} {c.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        </div>
                        <Input
                          type="tel"
                          placeholder="Phone number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="flex-1 bg-background/50 border-border focus:border-[#00D4FF] h-11"
                        />
                      </div>
                    </div>

                    {/* Country + Investment Range */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Country
                        </Label>
                        <Input
                          type="text"
                          placeholder="United States"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="bg-background/50 border-border focus:border-[#00D4FF] h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Investment Range
                        </Label>
                        <div className="relative">
                          <select
                            value={investmentRange}
                            onChange={(e) => setInvestmentRange(e.target.value)}
                            className="w-full h-11 rounded-md border border-border bg-background/50 px-3 pr-8 text-sm appearance-none focus:border-[#00D4FF] focus:outline-none"
                          >
                            <option value="">Select range...</option>
                            {INVESTMENT_RANGES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Notes / Comments
                        <span className="ml-2 normal-case font-normal text-muted-foreground/60">(optional)</span>
                      </Label>
                      <Textarea
                        placeholder="Tell us about your investment goals, questions, preferred contact time, or anything else you'd like us to know..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="bg-background/50 border-border focus:border-[#00D4FF] min-h-[110px] resize-none text-sm"
                      />
                    </div>

                    {/* Submit */}
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full h-12 bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-bold text-base hover:from-[#22D3EE] hover:to-[#00D4FF] transition-all shadow-lg shadow-[#00D4FF]/20"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Get Private Access
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>

                    {/* Trust line */}
                    <div className="flex items-center justify-center gap-4 pt-1">
                      {[
                        { icon: Lock,        text: "Secure & Private" },
                        { icon: ShieldCheck, text: "No Spam" },
                        { icon: Send,        text: "24h Response" },
                      ].map((t) => (
                        <div key={t.text} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <t.icon className="w-3 h-3 text-[#00D4FF]" />
                          {t.text}
                        </div>
                      ))}
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Below-form social proof */}
            <div className="mt-4 flex items-center gap-3 px-2">
              <div className="flex -space-x-2">
                {["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-amber-500"].map((c, i) => (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full border-2 border-card ${c} flex items-center justify-center text-[10px] font-bold text-white`}
                  >
                    {["J", "M", "A", "R"][i]}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-foreground font-medium">500+ clients</span> already trading with Terra Invest VIP
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer strip */}
      <footer className="relative z-10 border-t border-border px-6 lg:px-14 py-5 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Terra Invest VIP. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="text-xs text-muted-foreground hover:text-[#00D4FF] transition-colors">
            Home
          </Link>
          <span className="text-border hidden sm:inline">|</span>
          <Link href="/auth/login" className="text-xs text-muted-foreground hover:text-[#00D4FF] transition-colors">
            Sign in
          </Link>
          <span className="text-border hidden sm:inline">|</span>
          <p className="text-xs text-muted-foreground">terrainvest.vip</p>
        </div>
      </footer>
    </div>
  );
}
