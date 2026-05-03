"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicSiteNavProps = {
  className?: string;
  homeHref?: string;
  /** Hide Back when there is no sensible prior route (e.g. optional). */
  showBack?: boolean;
};

export function PublicSiteNav({
  className,
  homeHref = "/",
  showBack = true,
}: PublicSiteNavProps) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(homeHref);
    }
  }

  return (
    <nav
      className={cn("flex flex-wrap items-center justify-end gap-2", className)}
      aria-label="Site navigation"
    >
      {showBack && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={goBack}
          className="h-9 gap-1.5 border-border bg-card/60 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          Back
        </Button>
      )}
      <Link
        href={homeHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-9 gap-1.5 border-border bg-card/60 text-muted-foreground hover:text-foreground"
        )}
      >
        <Home className="w-4 h-4 shrink-0" />
        Home
      </Link>
    </nav>
  );
}
