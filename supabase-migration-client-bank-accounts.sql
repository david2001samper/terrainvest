-- Saved bank accounts for clients + bank snapshot on withdrawal requests
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS client_bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT,
  bank_name TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  account_number_or_iban TEXT NOT NULL,
  routing_number TEXT,
  swift_bic TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_bank_accounts_user_id ON client_bank_accounts(user_id);

ALTER TABLE client_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank accounts" ON client_bank_accounts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin read client bank accounts" ON client_bank_accounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS bank_details JSONB;

COMMENT ON COLUMN withdrawal_requests.bank_details IS 'Snapshot of bank destination at request time (for bank method)';
