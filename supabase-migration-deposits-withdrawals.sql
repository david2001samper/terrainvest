-- Migration: Deposits, Withdrawals, Lock accounts, Content pages
-- Run in Supabase SQL Editor

-- Add is_locked to profiles (admin can lock users from trading)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(20, 2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('btc', 'usdt', 'bank')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- RLS for withdrawal_requests
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawal requests" ON withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawal requests" ON withdrawal_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all withdrawal requests" ON withdrawal_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update withdrawal requests" ON withdrawal_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow authenticated users to read wallet addresses
CREATE POLICY "Authenticated users can read wallet settings" ON platform_settings
  FOR SELECT USING (
    auth.role() = 'authenticated' AND key IN ('wallet_btc', 'wallet_usdt')
  );

-- Allow anyone to read public content (about, terms, privacy, contact, support)
CREATE POLICY "Anyone can read public content" ON platform_settings
  FOR SELECT USING (
    key IN ('about_us', 'terms_of_service', 'privacy_policy', 'contact_us', 'support')
  );

-- Platform settings for content and wallets
INSERT INTO platform_settings (key, value, updated_at) VALUES
  ('wallet_btc', '', NOW()),
  ('wallet_usdt', '', NOW()),
  ('about_us', 'Terra Invest VIP is a premium trading platform for elite investors.', NOW()),
  ('terms_of_service', 'By using this platform, you agree to our terms of service.', NOW()),
  ('privacy_policy', 'We respect your privacy and protect your data.', NOW()),
  ('contact_us', 'Contact us at support@terrainvestvip.com', NOW()),
  ('support', 'For support, email support@terrainvestvip.com or use the contact form.', NOW())
ON CONFLICT (key) DO NOTHING;
