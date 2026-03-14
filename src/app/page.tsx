import Link from "next/link";
import {
  Shield,
  TrendingUp,
  BarChart3,
  Globe,
  ArrowRight,
  Lock,
  Zap,
  Award,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,255,0.1)_0%,_transparent_50%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#00D4FF]/5 rounded-full blur-[160px]" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#0EA5E9] flex items-center justify-center accent-glow">
            <Shield className="w-5 h-5 text-[#0A0B0F]" />
          </div>
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-[#00D4FF] text-xs font-medium mb-8">
          <Award className="w-3 h-3" />
          Exclusive VIP Access
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight max-w-4xl mx-auto">
          Premium Trading for{" "}
          <span className="accent-gradient">Elite Investors</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-6 leading-relaxed">
          Access global markets with institutional-grade execution. Cryptocurrencies,
          stocks, commodities, and indexes — all from one sophisticated platform.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] rounded-xl hover:from-[#22D3EE] hover:to-[#00D4FF] transition-all accent-glow"
          >
            Open Account
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-medium border border-border text-foreground rounded-xl hover:border-[#00D4FF]/30 hover:bg-[#00D4FF]/5 transition-all"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 lg:px-12 pb-32 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: Globe,
              title: "Global Markets",
              desc: "Trade crypto, stocks, commodities, and major indexes worldwide.",
            },
            {
              icon: Zap,
              title: "Instant Execution",
              desc: "Market orders executed in milliseconds with best-price guarantee.",
            },
            {
              icon: BarChart3,
              title: "Live Analytics",
              desc: "Real-time charts, portfolio tracking, and performance insights.",
            },
            {
              icon: Lock,
              title: "Bank-Grade Security",
              desc: "Enterprise-level encryption and multi-factor authentication.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass-card-hover p-6 rounded-xl"
            >
              <div className="w-11 h-11 rounded-xl bg-[#00D4FF]/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-[#00D4FF]" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 lg:px-12 py-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00D4FF]" />
            <span className="text-sm font-medium accent-gradient">Terra Invest VIP</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Terra Invest VIP. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
