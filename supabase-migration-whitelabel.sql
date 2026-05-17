-- Migration: White-label platform configuration + default balance change
-- Run in Supabase SQL Editor.

-- 1. Change default_balance to 0 (from 10000000)
INSERT INTO platform_settings (key, value) VALUES ('default_balance', '0')
ON CONFLICT (key) DO UPDATE SET value = '0', updated_at = now();

-- 2. Insert branding defaults (will NOT overwrite if admin already customised them)
INSERT INTO platform_settings (key, value) VALUES
  ('platform_name',        'Terra Invest VIP'),
  ('platform_short_name',  'Terra Invest'),
  ('platform_tagline',     'Premium Trading Platform'),
  ('platform_logo_url',    '/logo.png'),
  ('primary_brand_color',  '#00D4FF'),
  ('secondary_brand_color','#0EA5E9'),
  ('platform_domain',      'terrainvest.vip'),
  ('platform_footer_domain','terrainvest.vip'),
  ('admin_email',          'admin@terrainvestvip.com'),
  ('email_from_name',      'Terra Invest VIP'),
  ('email_from_address',   'support@terrainvestvip.com'),
  ('admin_alert_email',    'admin@terrainvestvip.com'),
  ('email_provider',       'resend'),
  ('lead_allowed_origins', ''),
  ('approval_time_text',   'Approval usually takes 10 minutes to 1 hour, and your dedicated account manager will contact you shortly.'),
  ('email_enabled',        'false'),
  ('signup_approval_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 3. Update schema default for new installs
ALTER TABLE profiles ALTER COLUMN balance SET DEFAULT 0;
