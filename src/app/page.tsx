import Link from "next/link";
import {
  BarChart3,
  Globe,
  ArrowRight,
  Lock,
  Zap,
  Target,
  Heart,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { getHomeContent } from "@/lib/content";
import { getClientTestimonials, getVideoTestimonials } from "@/lib/testimonials";
import { ClientTestimonialsCarousel } from "@/components/client-testimonials-carousel";
import { VideoTestimonialsCarousel } from "@/components/video-testimonials-carousel";

export default async function LandingPage() {
  const [content, clientTestimonials, videoTestimonials] = await Promise.all([
    getHomeContent(),
    getClientTestimonials(),
    getVideoTestimonials(),
  ]);

  const journey = content.home_journey || "Founded with a vision to democratize premium trading, Terra Invest VIP has grown from a small team to a trusted platform serving elite investors worldwide.";
  const mission = content.home_mission || "To provide institutional-grade trading tools and execution to every investor, with transparency, security, and exceptional support at the core of everything we do.";
  const values = content.home_values || "Integrity • Innovation • Client-First • Excellence • Trust";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,255,0.1)_0%,_transparent_50%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#00D4FF]/5 rounded-full blur-[160px]" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <PlatformLogo size={48} className="shrink-0" />
          <span className="text-lg font-bold accent-gradient">Terra Invest VIP</span>
        </Link>
        <div className="flex items-center gap-3">
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <PlatformLogo size={20} />
            <span className="text-sm font-medium accent-gradient">Terra Invest VIP</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/content/about" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              About Us
            </Link>
            <Link href="/content/terms" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              Terms of Service
            </Link>
            <Link href="/content/privacy" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/content/contact" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              Contact Us
            </Link>
            <Link href="/content/support" className="text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors">
              Support
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Terra Invest VIP. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
