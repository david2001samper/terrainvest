import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Target,
  BookOpen,
  BarChart3,
  UserRoundCheck,
  ShieldCheck,
  Phone,
  HelpCircle,
  FileText,
  Lock,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { getContent, getContactInfo } from "@/lib/content";
import { PUBLIC_CONTENT_PAGES, getPublicContentPage } from "@/lib/public-content";
import { PublicSiteNav } from "@/components/public-site-nav";

const SLUG_ICONS: Record<string, typeof Target> = {
  about: Target,
  journey: BookOpen,
  history: ShieldCheck,
  "trading-approach": BarChart3,
  "account-management": UserRoundCheck,
  contact: Phone,
  support: HelpCircle,
  terms: FileText,
  privacy: Lock,
};

const SLUG_ACCENT: Record<string, string> = {
  about: "#00D4FF",
  journey: "#A78BFA",
  history: "#F59E0B",
  "trading-approach": "#34D399",
  "account-management": "#60A5FA",
  contact: "#F472B6",
  support: "#FB923C",
  terms: "#94A3B8",
  privacy: "#94A3B8",
};

export default async function ContentPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const pageMeta = getPublicContentPage(page);
  if (!pageMeta) {
    notFound();
  }

  const [content, contactInfo] = await Promise.all([getContent(page), getContactInfo()]);
  const accent = SLUG_ACCENT[page] ?? "#00D4FF";
  const Icon = SLUG_ICONS[page] ?? Target;

  const relatedPages = PUBLIC_CONTENT_PAGES.filter(
    (item) => item.slug !== page && !["terms", "privacy"].includes(item.slug)
  ).slice(0, 3);

  const paragraphs = content
    ? content.split(/\n\n+/).filter((p) => p.trim().length > 0)
    : [];

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,255,0.06)_0%,_transparent_50%)]" />
      <div
        className="absolute top-0 right-0 w-[600px] h-[500px] rounded-full blur-[180px] opacity-[0.07]"
        style={{ background: accent }}
      />

      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <PlatformLogo size={96} className="shrink-0" />
          <span className="text-lg font-bold accent-gradient">Terra Invest VIP</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-5 mr-2">
            {PUBLIC_CONTENT_PAGES.filter((p) =>
              ["journey", "trading-approach", "contact"].includes(p.slug)
            ).map((p) => (
              <Link
                key={p.slug}
                href={`/content/${p.slug}`}
                className={`text-sm transition-colors ${
                  p.slug === page
                    ? "text-[#00D4FF] font-medium"
                    : "text-muted-foreground hover:text-[#00D4FF]"
                }`}
              >
                {p.navLabel}
              </Link>
            ))}
          </div>
          <PublicSiteNav />
        </div>
      </nav>

      {/* Hero banner */}
      <header className="relative z-10 px-6 lg:px-12 pt-12 pb-16 max-w-5xl mx-auto">
        <div className="flex items-start gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
          >
            <Icon className="w-6 h-6" style={{ color: accent }} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: accent }}>
              Terra Invest VIP
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              {pageMeta.title}
            </h1>
            <p className="text-muted-foreground leading-relaxed mt-4 max-w-2xl text-base sm:text-lg">
              {pageMeta.summary}
            </p>
          </div>
        </div>
      </header>

      {/* Content body */}
      <main className="relative z-10 px-6 lg:px-12 pb-20 max-w-5xl mx-auto">
        {paragraphs.length > 0 ? (
          <div className="space-y-0">
            {paragraphs.map((para, i) => (
              <div
                key={i}
                className={`relative py-6 ${
                  i !== paragraphs.length - 1 ? "border-b border-border/60" : ""
                }`}
              >
                <div className="flex gap-5">
                  <div className="hidden sm:flex flex-col items-center pt-1.5">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: accent, opacity: 0.6 }}
                    />
                  </div>
                  <p className="text-[15px] sm:text-base text-muted-foreground leading-[1.85] max-w-3xl">
                    {para}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No content available yet.</p>
        )}

        {/* Contact CTA on non-contact/support pages */}
        {page !== "contact" && page !== "support" && page !== "terms" && page !== "privacy" && (
          <div className="mt-12 rounded-2xl border border-[#00D4FF]/15 bg-[#00D4FF]/[0.03] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">Have questions about this?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Reach the Terra Invest VIP team for onboarding or account enquiries.
              </p>
            </div>
            <Link
              href="/content/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] rounded-lg hover:from-[#22D3EE] hover:to-[#00D4FF] transition-all accent-glow shrink-0"
            >
              Contact Us
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Phone + email only on contact/support pages */}
        {(page === "contact" || page === "support") && (
          <div className="mt-12 rounded-2xl border border-[#00D4FF]/15 bg-[#00D4FF]/[0.03] p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#00D4FF] mb-4">
              Get in touch
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <a
                href={`tel:${contactInfo.phone}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-[#00D4FF] transition-colors"
              >
                <Phone className="w-4 h-4 text-[#00D4FF]" />
                {contactInfo.phone}
              </a>
              <a
                href={`mailto:${contactInfo.email}`}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[#00D4FF] transition-colors"
              >
                {contactInfo.email}
              </a>
            </div>
          </div>
        )}

        {/* Related pages */}
        <div className="mt-14">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-5">
            Explore More
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedPages.map((item) => {
              const RelIcon = SLUG_ICONS[item.slug] ?? Target;
              const relAccent = SLUG_ACCENT[item.slug] ?? "#00D4FF";
              return (
                <Link
                  key={item.slug}
                  href={`/content/${item.slug}`}
                  className="group rounded-2xl border border-border bg-card/60 p-5 transition-all hover:border-[#00D4FF]/30 hover:bg-card/80 hover:-translate-y-0.5"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${relAccent}12` }}
                  >
                    <RelIcon className="w-4 h-4" style={{ color: relAccent }} />
                  </div>
                  <p className="font-semibold text-sm group-hover:text-[#00D4FF] transition-colors">
                    {item.homeTitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                    {item.homeDescription}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 lg:px-12 py-10 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <PlatformLogo size={36} />
            <span className="text-sm font-medium accent-gradient">Terra Invest VIP</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-5">
            {PUBLIC_CONTENT_PAGES.map((p) => (
              <Link
                key={p.slug}
                href={`/content/${p.slug}`}
                className={`text-xs transition-colors ${
                  p.slug === page
                    ? "text-[#00D4FF]"
                    : "text-muted-foreground hover:text-[#00D4FF]"
                }`}
              >
                {p.navLabel}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Terra Invest VIP
          </p>
        </div>
      </footer>
    </div>
  );
}
