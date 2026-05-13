"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Users,
  History,
  Settings,
  LogOut,
  LayoutDashboard,
  ArrowLeft,
  Layers,
  TrendingUp,
  ArrowUpCircle,
  MessageSquare,
  Shield,
  Banknote,
  Menu,
  X,
  ClipboardList,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: Banknote },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpCircle },
  { href: "/admin/trades", label: "All Trades", icon: History },
  { href: "/admin/assets", label: "Assets", icon: Layers },
  { href: "/admin/price-overrides", label: "Price Overrides", icon: TrendingUp },
  { href: "/admin/permissions", label: "Permissions", icon: Shield },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquare },
  { href: "/admin/leads", label: "Leads", icon: ClipboardList },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchPendingCount() {
      try {
        const res = await fetch("/api/admin/clients/pending-count");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPendingCount(data.count ?? 0);
      } catch { /* ignore */ }
    }
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/auth/login");
  }

  const sidebarContent = (
    <>
      <Link
        href="/"
        onClick={() => setMobileOpen(false)}
        className="p-4 border-b border-border flex items-center gap-3 hover:opacity-90 transition-opacity"
      >
        <PlatformLogo size={96} className="shrink-0" />
        <div>
          <h2 className="font-bold text-sm">Admin Panel</h2>
          <p className="text-[11px] text-muted-foreground">Terra Invest VIP</p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {adminNav.map((item) => {
          const isActive = pathname === item.href;
          const showBadge = item.href === "/admin/clients" && pendingCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-red-400" : ""}`} />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-[#00D4FF] hover:bg-[#00D4FF]/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Platform
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <div className="lg:hidden fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="glass-card accent-border inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground"
          aria-label={mobileOpen ? "Close admin menu" : "Open admin menu"}
          aria-expanded={mobileOpen}
          aria-controls="admin-mobile-sidebar"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <span className="glass-card accent-border rounded-lg px-3 py-2 text-sm font-semibold">
          Admin
        </span>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
          aria-label="Close admin menu"
        />
      )}

      <aside
        id="admin-mobile-sidebar"
        className={`lg:hidden fixed top-0 left-0 h-full w-72 glass-card z-50 flex flex-col transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 glass-card border-r border-border">
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="p-4 pt-16 lg:p-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
