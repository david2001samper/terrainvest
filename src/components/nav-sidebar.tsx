"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { usePositions } from "@/hooks/use-positions";
import { useMarketData } from "@/hooks/use-market-data";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { toast } from "sonner";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  History,
  Heart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Menu,
  X,
  Settings,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/history", label: "Trade History", icon: History },
  { href: "/watchlist", label: "Watchlist", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: positions } = usePositions();
  const { allAssets } = useMarketData();
  const { format: formatCurrency } = useCurrencyFormat();

  const totalPositionValue =
    positions?.reduce(
      (sum, p) =>
        sum +
        p.quantity * (allAssets.find((a) => a.symbol === p.symbol)?.price ?? p.entry_price),
      0
    ) ?? 0;
  const totalPortfolio = (profile?.balance ?? 0) + totalPositionValue;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/auth/login");
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <Link href="/" className="p-4 flex items-center gap-3 border-b border-border hover:opacity-90 transition-opacity">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#0EA5E9] flex items-center justify-center shrink-0 accent-glow">
          <Shield className="w-5 h-5 text-[#0A0B0F]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="font-bold text-sm accent-gradient truncate">Terra Invest VIP</h2>
            <p className="text-[11px] text-muted-foreground truncate">Premium Trading</p>
          </div>
        )}
      </Link>

      {!collapsed && profile && (
        <div className="p-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-1">Total Portfolio</p>
          <p className="text-lg font-bold accent-gradient">
            {formatCurrency(totalPortfolio)}
          </p>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[#00D4FF]" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        {!collapsed && profile && (
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            <p className="text-xs text-[#00D4FF]">VIP Level {profile.vip_level}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="glass-card accent-border"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-72 glass-card z-50 transform transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col h-screen sticky top-0 glass-card border-r border-border transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#1A1C24] border border-border flex items-center justify-center text-muted-foreground hover:text-[#00D4FF] hover:border-[#00D4FF]/30 transition-all"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>
    </>
  );
}
