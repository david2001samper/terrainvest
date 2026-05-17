"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformLogo } from "@/components/platform-logo";
import { Clock, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function PendingApprovalPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,255,0.08)_0%,_transparent_50%)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan/5 rounded-full blur-[120px]" />

      <Card className="w-full max-w-md glass-card accent-border relative z-10">
        <CardContent className="pt-10 pb-8 px-8 text-center">
          <Link href="/" className="mx-auto block w-fit hover:opacity-90 transition-opacity mb-6">
            <PlatformLogo size={160} />
          </Link>

          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>

          <h1 className="text-2xl font-bold mb-3">Account Pending Approval</h1>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-sm mx-auto">
            Your account has been created and is awaiting approval. Approval usually takes
            10 minutes to 1 hour, and your dedicated account manager will contact you shortly.
          </p>

          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full h-11 border-border hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>

          <p className="mt-6 text-xs text-muted-foreground">
            If you believe this is an error, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
