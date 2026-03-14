"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_TITLES: Record<string, string> = {
  about: "About Us",
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  contact: "Contact Us",
  support: "Support",
};

export default function ContentPage() {
  const params = useParams();
  const page = (params.page as string) ?? "about";

  const { data, isLoading } = useQuery({
    queryKey: ["content", page],
    queryFn: async () => {
      const res = await fetch(`/api/content?page=${page}`);
      if (!res.ok) return { content: "" };
      return res.json();
    },
  });

  const title = PAGE_TITLES[page] ?? "Page";
  const content = data?.content ?? "";

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,212,255,0.08)_0%,_transparent_50%)]" />

      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#0EA5E9] flex items-center justify-center accent-glow">
            <Shield className="w-5 h-5 text-[#0A0B0F]" />
          </div>
          <span className="text-lg font-bold accent-gradient">Terra Invest VIP</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </nav>

      <main className="relative z-10 px-6 lg:px-12 py-12 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">{title}</h1>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : content ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed bg-transparent p-0 border-0">
              {content}
            </pre>
          </div>
        ) : (
          <p className="text-muted-foreground">No content available yet.</p>
        )}
      </main>
    </div>
  );
}
