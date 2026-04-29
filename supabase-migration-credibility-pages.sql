-- Migration: Public credibility pages + contact info
-- Run in Supabase SQL Editor

-- Drop old policy if it exists, then recreate with contact keys included.
DROP POLICY IF EXISTS "Anyone can read credibility content" ON platform_settings;
CREATE POLICY "Anyone can read credibility content" ON platform_settings
  FOR SELECT USING (
    key IN ('journey', 'our_history', 'trading_approach', 'account_management', 'contact_phone', 'contact_email')
  );

INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('journey', 'Terra Invest VIP was developed to bring a more structured and personal trading experience to private clients. The platform was built around a simple idea: clients should have access to market tools, timely guidance, and a dedicated support relationship in one secure environment.' || E'\n\n' || 'Our journey continues through investment in platform reliability, market visibility, account support, and clearer communication between clients and their assigned account manager.', NOW()),
  ('our_history', 'Terra Invest VIP was established with a focus on private client trading services, market access, and account support. Over time, the platform has expanded from core trading and portfolio tools into a broader client environment that includes market data, watchlists, analytics, deposits, withdrawals, and administrative oversight.' || E'\n\n' || 'The company''s operating philosophy is built on professionalism, communication, transparency, and disciplined trading processes.', NOW()),
  ('trading_approach', 'Terra Invest VIP provides trading guidance through a structured signal and account management framework. Trade ideas may include the proposed trade amount, entry area, stop-loss level, take-profit target, and relevant market context.' || E'\n\n' || 'Clients retain discretion over trade execution. They can review, execute, modify, or decline trade signals directly through the Terra Invest VIP platform. This approach keeps the client in control while providing professional market guidance and clearly defined risk parameters.', NOW()),
  ('account_management', 'Each client relationship is supported through a dedicated account management model. Account managers assist with onboarding, platform navigation, trade signal communication, performance updates, and service-related questions.' || E'\n\n' || 'This structure gives clients a clear point of contact and helps ensure that trading guidance, account updates, and support requests are handled in a professional and consistent way.', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('contact_phone', '+16478007539', NOW()),
  ('contact_email', 'support@terrainvestvip.com', NOW())
ON CONFLICT (key) DO NOTHING;
