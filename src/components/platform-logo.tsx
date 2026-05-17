import Image from "next/image";
import { BRANDING_DEFAULTS } from "@/lib/platform-config";

interface PlatformLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function PlatformLogo({ size = 96, className = "", alt }: PlatformLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt={alt ?? BRANDING_DEFAULTS.platform_short_name}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
