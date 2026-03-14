"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { PlatformLogo } from "@/components/platform-logo";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.displayName },
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Account created. Welcome to Terra Invest VIP.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,255,0.08)_0%,_transparent_50%)]" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan/5 rounded-full blur-[120px]" />

      <Card className="w-full max-w-md glass-card accent-border relative z-10">
        <CardHeader className="text-center space-y-4 pb-2">
          <Link href="/" className="mx-auto block w-fit hover:opacity-90 transition-opacity">
            <PlatformLogo size={160} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold accent-gradient">Create Account</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Join our exclusive investment platform
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm text-muted-foreground">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Your full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-background/50 border-border focus:border-[#00D4FF] focus:ring-[#00D4FF]/20 h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-border focus:border-[#00D4FF] focus:ring-[#00D4FF]/20 h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50 border-border focus:border-[#00D4FF] focus:ring-[#00D4FF]/20 h-11 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#00D4FF] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] hover:from-[#22D3EE] hover:to-[#00D4FF] text-[#0A0B0F] font-semibold transition-all duration-300"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#0A0B0F]/30 border-t-[#0A0B0F] rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-[#00D4FF] hover:text-[#22D3EE] font-medium transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
