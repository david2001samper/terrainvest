-- Migration: Trading permissions, leverage, forex support, options positions
-- Run in Supabase SQL Editor

-- Per-client trading permissions (all default FALSE; admin must grant)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_trade_crypto BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_trade_stocks BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_trade_indexes BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_trade_commodities BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_trade_forex BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_trade_options BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_leverage INTEGER NOT NULL DEFAULT 1;

-- Track leverage used at entry for forex/leveraged positions
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS leverage INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS asset_type TEXT;

-- Options positions table
CREATE TABLE IF NOT EXISTS options_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contract_symbol TEXT NOT NULL,
  underlying_symbol TEXT NOT NULL,
  option_type TEXT NOT NULL CHECK (option_type IN ('call', 'put')),
  strike NUMERIC(20, 4) NOT NULL,
  expiry TIMESTAMPTZ NOT NULL,
  quantity INTEGER NOT NULL,
  entry_premium NUMERIC(20, 4) NOT NULL,
  current_premium NUMERIC(20, 4),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired', 'exercised')),
  closed_premium NUMERIC(20, 4),
  realized_pnl NUMERIC(20, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_options_positions_user_id ON options_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_options_positions_status ON options_positions(status);

ALTER TABLE options_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own options positions" ON options_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own options positions" ON options_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own options positions" ON options_positions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all options positions" ON options_positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
