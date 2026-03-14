-- Migration: Home page editable sections
-- Run in Supabase SQL Editor

-- Allow anyone to read home content
CREATE POLICY "Anyone can read home content" ON platform_settings
  FOR SELECT USING (
    key IN ('home_journey', 'home_mission', 'home_values', 'home_cta')
  );

INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('home_journey', 'Founded with a vision to democratize premium trading, Terra Invest VIP has grown from a small team to a trusted platform serving elite investors worldwide. Our journey is driven by innovation, transparency, and unwavering commitment to our clients.', NOW()),
  ('home_mission', 'To provide institutional-grade trading tools and execution to every investor, with transparency, security, and exceptional support at the core of everything we do.', NOW()),
  ('home_values', 'Integrity • Innovation • Client-First • Excellence • Trust', NOW()),
  ('home_cta', 'Join thousands of investors who trust Terra Invest VIP for their trading needs. Open your account today and experience the difference.', NOW())
ON CONFLICT (key) DO NOTHING;
