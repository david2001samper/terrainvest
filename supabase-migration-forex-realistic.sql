-- Migration: Realistic Forex (CFD) trading model
-- Run in Supabase SQL Editor

-- FX instruments table (admin-tunable parameters)
CREATE TABLE IF NOT EXISTS forex_instruments (
  symbol TEXT PRIMARY KEY,
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  contract_size INTEGER NOT NULL DEFAULT 100000,
  pip_size NUMERIC(20, 6) NOT NULL,
  typical_spread_pips NUMERIC(20, 4) NOT NULL DEFAULT 1.2,
  swap_long_bps NUMERIC(20, 4) NOT NULL DEFAULT -2.0,
  swap_short_bps NUMERIC(20, 4) NOT NULL DEFAULT -2.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed common majors used by the app
INSERT INTO forex_instruments (symbol, base, quote, pip_size, typical_spread_pips, swap_long_bps, swap_short_bps)
VALUES
  ('EURUSD=X', 'EUR', 'USD', 0.0001, 0.9, -2.0, -1.0),
  ('GBPUSD=X', 'GBP', 'USD', 0.0001, 1.2, -2.5, -1.2),
  ('USDJPY=X', 'USD', 'JPY', 0.01,   1.0, -2.0, -1.5),
  ('AUDUSD=X', 'AUD', 'USD', 0.0001, 1.3, -2.2, -1.2),
  ('USDCHF=X', 'USD', 'CHF', 0.0001, 1.4, -2.0, -1.4),
  ('USDCAD=X', 'USD', 'CAD', 0.0001, 1.5, -2.0, -1.4),
  ('NZDUSD=X', 'NZD', 'USD', 0.0001, 1.6, -2.2, -1.2),
  ('EURGBP=X', 'EUR', 'GBP', 0.0001, 1.1, -2.4, -1.3),
  ('EURJPY=X', 'EUR', 'JPY', 0.01,   1.6, -2.6, -1.6),
  ('GBPJPY=X', 'GBP', 'JPY', 0.01,   1.8, -2.8, -1.7)
ON CONFLICT (symbol) DO NOTHING;

-- Forex positions (CFD, netting per pair)
CREATE TABLE IF NOT EXISTS forex_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,

  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  contract_size INTEGER NOT NULL DEFAULT 100000,
  pip_size NUMERIC(20, 6) NOT NULL,

  -- Net position in base units: >0 long, <0 short
  units_signed NUMERIC(28, 8) NOT NULL DEFAULT 0,
  avg_entry_price NUMERIC(28, 10),

  -- Last known marks (for UI convenience)
  last_mid NUMERIC(28, 10),
  last_bid NUMERIC(28, 10),
  last_ask NUMERIC(28, 10),

  leverage INTEGER NOT NULL DEFAULT 1,
  margin_used_usd NUMERIC(28, 8) NOT NULL DEFAULT 0,
  swap_accrued_usd NUMERIC(28, 8) NOT NULL DEFAULT 0,
  last_swap_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forex_positions_user_symbol
  ON forex_positions(user_id, symbol);

CREATE INDEX IF NOT EXISTS idx_forex_positions_user_id
  ON forex_positions(user_id);

ALTER TABLE forex_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_instruments ENABLE ROW LEVEL SECURITY;

-- Users can read their own positions
CREATE POLICY "Users can view own forex positions" ON forex_positions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert/update their own positions (server-side API uses user session)
CREATE POLICY "Users can insert own forex positions" ON forex_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own forex positions" ON forex_positions
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin can manage all forex positions
CREATE POLICY "Admin can manage all forex positions" ON forex_positions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Instruments are readable by all authenticated users (for pricing/UI)
CREATE POLICY "Users can read forex instruments" ON forex_instruments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin can manage instruments
CREATE POLICY "Admin can manage forex instruments" ON forex_instruments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

