import Link from "next/link";
import {
  BarChart3,
  Globe,
  ArrowRight,
  Lock,
  Zap,
  Target,
  Heart,
  BookOpen,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { getHomeContent } from "@/lib/content";
import { getClientTestimonials, getVideoTestimonials } from "@/lib/testimonials";
import { getHomeMarketSnapshot } from "@/lib/market-snapshot";
import { ClientTestimonialsCarousel } from "@/components/client-testimonials-carousel";
import { VideoTestimonialsCarousel } from "@/components/video-testimonials-carousel";
import { MarketSnapshotGrid } from "@/components/market-snapshot-grid";
import { PUBLIC_CONTENT_PAGES } from "@/lib/public-content";
import { LeadsForm } from "@/components/leads-form";
import { getPlatformBranding } from "@/lib/platform-config";

export default async function LandingPage() {
  const [content, clientTestimonials, videoTestimonials, marketSnapshot, branding] = await Promise.all([
    getHomeContent(),
    getClientTestimonials(),
    getVideoTestimonials(),
    getHomeMarketSnapshot(),
    getPlatformBranding(),
  ]);

  const journey = content.home_journey || "Founded with a vision to democratize premium trading, Terra Invest VIP has grown from a small team to a trusted platform serving elite investors worldwide.";
  const mission = content.home_mission || "To provide institutional-grade trading tools and execution to every investor, with transparency, security, and exceptional support at the core of everything we do.";
  const values = content.home_values || "Integrity • Innovation • Client-First • Excellence • Trust";
  const credibilityPages = PUBLIC_CONTENT_PAGES.filter((page) =>
    ["journey", "history", "trading-approach", "account-management", "contact"].includes(page.slug)
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,255,0.1)_0%,_transparent_50%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#00D4FF]/5 rounded-full blur-[160px]" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <PlatformLogo size={96} className="shrink-0" />
          <span className="text-lg font-bold accent-gradient">{branding.platform_name}</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-5 mr-2">
            <Link href="/content/journey" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              Our Journey
            </Link>
            <Link href="/content/trading-approach" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              Trading Approach
            </Link>
            <Link href="/content/contact" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              Contact
            </Link>
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </Link>
          <Link
            href="/auth/login"
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] rounded-lg hover:from-[#22D3EE] hover:to-[#00D4FF] transition-all accent-glow"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 lg:px-12 pt-20 pb-32 max-w-7xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight max-w-5xl mx-auto">
          Exclusive Trading for High-Net-Worth Individuals
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mt-6 leading-relaxed">
          Real-time markets • Advanced tools • Private experience
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] rounded-xl hover:from-[#22D3EE] hover:to-[#00D4FF] transition-all accent-glow"
          >
            Create VIP Account
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-medium border border-border text-foreground rounded-xl hover:border-[#00D4FF]/30 hover:bg-[#00D4FF]/5 transition-all"
          >
            Login
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 lg:px-12 pb-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Globe, title: "Global Markets", desc: "Trade crypto, stocks, commodities, and major indexes worldwide." },
            { icon: Zap, title: "Instant Execution", desc: "Market orders executed in milliseconds with best-price guarantee." },
            { icon: BarChart3, title: "Live Analytics", desc: "Real-time charts, portfolio tracking, and performance insights." },
            { icon: Lock, title: "Bank-Grade Security", desc: "Enterprise-level encryption and multi-factor authentication." },
          ].map((feature) => (
            <div key={feature.title} className="glass-card-hover p-6 rounded-xl">
              <div className="w-11 h-11 rounded-xl bg-[#00D4FF]/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-[#00D4FF]" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Market Prices */}
      <MarketSnapshotGrid assets={marketSnapshot} />

      {/* Credibility Pages */}
      <section className="relative z-10 px-6 lg:px-12 py-24 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#00D4FF] mb-4">
            Private Client Framework
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold max-w-2xl mx-auto leading-tight">
            Built on structure, guided by transparency
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto mt-5">
            Every part of the {branding.platform_name} experience is designed around clarity,
            accountability, and professional client service.
          </p>
        </div>

        {/* Featured row — Journey + Trading Approach side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {[
            {
              slug: "journey",
              icon: BookOpen,
              accent: "#A78BFA",
              label: "Our Story",
              title: credibilityPages.find((p) => p.slug === "journey")?.homeTitle ?? "Our Journey",
              desc: credibilityPages.find((p) => p.slug === "journey")?.homeDescription ?? "",
            },
            {
              slug: "trading-approach",
              icon: BarChart3,
              accent: "#34D399",
              label: "Methodology",
              title: credibilityPages.find((p) => p.slug === "trading-approach")?.homeTitle ?? "Trading Approach",
              desc: credibilityPages.find((p) => p.slug === "trading-approach")?.homeDescription ?? "",
            },
          ].map((card) => (
            <Link
              key={card.slug}
              href={`/content/${card.slug}`}
              className="group relative rounded-2xl border border-border bg-card/60 p-7 sm:p-8 transition-all hover:border-[#00D4FF]/25 hover:-translate-y-0.5 overflow-hidden"
            >
              <div
                className="absolute top-0 right-0 w-[220px] h-[180px] rounded-full blur-[100px] opacity-[0.06]"
                style={{ background: card.accent }}
              />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${card.accent}15`, border: `1px solid ${card.accent}25` }}
                  >
                    <card.icon className="w-5 h-5" style={{ color: card.accent }} />
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: card.accent }}
                  >
                    {card.label}
                  </span>
                </div>
                <h3 className="text-lg font-bold group-hover:text-[#00D4FF] transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-md">
                  {card.desc}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-5 text-[#00D4FF] opacity-0 group-hover:opacity-100 transition-opacity">
                  Read more <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Secondary row — History, Account Mgmt, Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              slug: "history",
              icon: ShieldCheck,
              accent: "#F59E0B",
              title: credibilityPages.find((p) => p.slug === "history")?.homeTitle ?? "Our History",
              desc: credibilityPages.find((p) => p.slug === "history")?.homeDescription ?? "",
            },
            {
              slug: "account-management",
              icon: UserRoundCheck,
              accent: "#60A5FA",
              title: credibilityPages.find((p) => p.slug === "account-management")?.homeTitle ?? "Account Management",
              desc: credibilityPages.find((p) => p.slug === "account-management")?.homeDescription ?? "",
            },
            {
              slug: "contact",
              icon: ShieldCheck,
              accent: "#F472B6",
              title: credibilityPages.find((p) => p.slug === "contact")?.homeTitle ?? "Contact & Support",
              desc: credibilityPages.find((p) => p.slug === "contact")?.homeDescription ?? "",
            },
          ].map((card) => (
            <Link
              key={card.slug}
              href={`/content/${card.slug}`}
              className="group rounded-2xl border border-border bg-card/40 p-6 transition-all hover:border-[#00D4FF]/25 hover:-translate-y-0.5"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${card.accent}12` }}
              >
                <card.icon className="w-4 h-4" style={{ color: card.accent }} />
              </div>
              <h3 className="font-semibold text-sm group-hover:text-[#00D4FF] transition-colors">
                {card.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-2 line-clamp-2">
                {card.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* What Our Clients Say */}
      <ClientTestimonialsCarousel testimonials={clientTestimonials} />

      {/* Our Journey */}
      <section className="relative z-10 px-6 lg:px-12 py-20 max-w-7xl mx-auto">
        <div className="glass-card p-8 lg:p-12 rounded-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-6 h-6 text-[#00D4FF]" />
            <h2 className="text-2xl font-bold">Our Journey</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            {journey}
          </p>
        </div>
      </section>

      {/* Mission & Values */}
      <section className="relative z-10 px-6 lg:px-12 pb-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card-hover p-8 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-[#00D4FF]" />
              <h3 className="text-xl font-bold">Our Mission</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">{mission}</p>
          </div>
          <div className="glass-card-hover p-8 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-[#00D4FF]" />
              <h3 className="text-xl font-bold">Our Values</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">{values}</p>
          </div>
        </div>
      </section>

      {/* Client Video Testimonials */}
      <VideoTestimonialsCarousel testimonials={videoTestimonials} />

      {/* Leads / Contact Form */}
      <section id="get-started" className="relative z-10 px-6 lg:px-12 py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-[#00D4FF] mb-4">
              Private Consultation
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-5">
              Start your investment journey today
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8 max-w-md">
              Fill out the form and one of our account managers will reach out within 24 hours to discuss your investment goals and how {branding.platform_name} can work for you.
            </p>
            <div className="space-y-4">
              {[
                { title: "Dedicated Account Manager", desc: "Personal support from a specialist who knows your portfolio." },
                { title: "Institutional-Grade Tools", desc: "Access the same analytics and execution as professional traders." },
                { title: "Strict Confidentiality", desc: "Your information is never shared with third parties." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#00D4FF]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div className="glass-card accent-border rounded-2xl p-7 sm:p-8">
            <h3 className="text-lg font-bold mb-1">Request a Consultation</h3>
            <p className="text-sm text-muted-foreground mb-6">
              No commitments — our team will get back to you shortly.
            </p>
            <LeadsForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 lg:px-12 pt-14 pb-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <PlatformLogo size={36} />
              <span className="text-sm font-bold accent-gradient">{branding.platform_name}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Private trading services and advisory platform for qualified clients.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              Company
            </p>
            <div className="flex flex-col gap-2">
              {PUBLIC_CONTENT_PAGES.filter((p) =>
                ["about", "journey", "history"].includes(p.slug)
              ).map((p) => (
                <Link
                  key={p.slug}
                  href={`/content/${p.slug}`}
                  className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors"
                >
                  {p.navLabel}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              Services
            </p>
            <div className="flex flex-col gap-2">
              {PUBLIC_CONTENT_PAGES.filter((p) =>
                ["trading-approach", "account-management", "support"].includes(p.slug)
              ).map((p) => (
                <Link
                  key={p.slug}
                  href={`/content/${p.slug}`}
                  className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors"
                >
                  {p.navLabel}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
              Legal & Contact
            </p>
            <div className="flex flex-col gap-2">
              {PUBLIC_CONTENT_PAGES.filter((p) =>
                ["contact", "terms", "privacy"].includes(p.slug)
              ).map((p) => (
                <Link
                  key={p.slug}
                  href={`/content/${p.slug}`}
                  className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors"
                >
                  {p.navLabel}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {branding.platform_name}. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            {branding.platform_domain}
          </p>
        </div>
      </footer>
    </div>
  );
}
