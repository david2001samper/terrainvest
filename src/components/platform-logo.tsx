"use client";

import { usePlatformBranding } from "@/hooks/use-platform-branding";

interface PlatformLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function PlatformLogo({ size = 96, className = "", alt }: PlatformLogoProps) {
  const branding = usePlatformBranding();
  const src = branding.platform_logo_url?.trim() || "/logo.png";

  return (
    <img
      src={src}
      alt={alt ?? branding.platform_short_name}
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
