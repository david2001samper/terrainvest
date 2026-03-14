"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Users,
  BarChart3,
  History,
  Settings,
  LogOut,
  LayoutDashboard,
  ArrowLeft,
  Layers,
  TrendingUp,
  ArrowUpCircle,
  MessageSquare,
} from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";
import { Button } from "@/components/ui/button";

const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpCircle },
  { href: "/admin/trades", label: "All Trades", icon: History },
  { href: "/admin/assets", label: "Assets", icon: Layers },
  { href: "/admin/price-overrides", label: "Price Overrides", icon: TrendingUp },
  { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/auth/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 glass-card border-r border-border">
        <Link href="/" className="p-4 border-b border-border flex items-center gap-3 hover:opacity-90 transition-opacity">
          <PlatformLogo size={48} className="shrink-0" />
          <div>
            <h2 className="font-bold text-sm">Admin Panel</h2>
            <p className="text-[11px] text-muted-foreground">Terra Invest VIP</p>
          </div>
        </Link>

        <nav className="flex-1 p-3 space-y-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-red-400" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Link
            href="/dashboard"
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
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="p-4 lg:p-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
