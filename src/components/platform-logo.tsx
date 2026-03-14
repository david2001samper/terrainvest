import Image from "next/image";

interface PlatformLogoProps {
  size?: number;
  className?: string;
}

export function PlatformLogo({ size = 48, className = "" }: PlatformLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Terra Invest"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority
    />
  );
}
