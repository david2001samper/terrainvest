export const BRANDING_DEFAULTS = {
  platform_name: "Terra Invest VIP",
  platform_short_name: "Terra Invest",
  platform_tagline: "Premium Trading Platform",
  platform_logo_url: "/logo.png",
  primary_brand_color: "#00D4FF",
  secondary_brand_color: "#0EA5E9",
  platform_domain: "terrainvest.vip",
  platform_footer_domain: "terrainvest.vip",
  admin_email: "admin@terrainvestvip.com",
  email_from_name: "Terra Invest VIP",
  email_from_address: "support@terrainvestvip.com",
  admin_alert_email: "admin@terrainvestvip.com",
  approval_time_text: "Approval usually takes 10 minutes to 1 hour, and your dedicated account manager will contact you shortly.",
  email_enabled: "false",
  signup_approval_enabled: "false",
} as const;

export type PlatformBranding = Record<keyof typeof BRANDING_DEFAULTS, string>;

export const BRANDING_KEYS = Object.keys(BRANDING_DEFAULTS) as (keyof typeof BRANDING_DEFAULTS)[];
