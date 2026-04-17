-- Terra Invest VIP - Supabase Database Schema
-- Run this SQL in the Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  balance NUMERIC(20, 2) NOT NULL DEFAULT 10000000.00,
  total_pnl NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
  vip_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ASSETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'stock', 'commodity', 'index')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TRADES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity NUMERIC(20, 8) NOT NULL,
  price NUMERIC(20, 8) NOT NULL,
  total NUMERIC(20, 2) NOT NULL,
  profit_loss NUMERIC(20, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'filled' CHECK (status IN ('filled', 'cancelled', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- POSITIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
  entry_price NUMERIC(20, 8) NOT NULL,
  current_value NUMERIC(20, 2) NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC(20, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- =====================================================
-- WATCHLIST TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- =====================================================
-- PLATFORM SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own; admins can read/update all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin can update all profiles" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Service role can insert profiles" ON profiles FOR INSERT WITH CHECK (true);

-- Trades: users see own trades; admins see all
CREATE POLICY "Users can view own trades" ON trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all trades" ON trades FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin can update all trades" ON trades FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Positions: users see own; admins see all
CREATE POLICY "Users can view own positions" ON positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own positions" ON positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own positions" ON positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own positions" ON positions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin can view all positions" ON positions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin can update all positions" ON positions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin can delete all positions" ON positions FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Watchlist: users see own
CREATE POLICY "Users can view own watchlist" ON watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert watchlist" ON watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete watchlist" ON watchlist FOR DELETE USING (auth.uid() = user_id);

-- Assets: everyone can read
CREATE POLICY "Anyone can view assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Admin can manage assets" ON assets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Platform settings: admin only
CREATE POLICY "Admin can manage settings" ON platform_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- TRIGGER: Auto-create profile on user signup
-- Uses platform_settings.default_balance (set in Admin → Settings)
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_bal NUMERIC := 0;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(value), '')::numeric, 0) INTO default_bal
  FROM platform_settings WHERE key = 'default_balance' LIMIT 1;

  INSERT INTO public.profiles (id, email, display_name, role, balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'admin@terrainvestvip.com' THEN 'admin' ELSE 'user' END,
    COALESCE(default_bal, 0)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SEED: Default Assets
-- =====================================================
INSERT INTO assets (symbol, name, asset_type) VALUES
  -- Cryptocurrencies
  ('BTC', 'Bitcoin', 'crypto'),
  ('ETH', 'Ethereum', 'crypto'),
  ('SOL', 'Solana', 'crypto'),
  ('XRP', 'XRP', 'crypto'),
  ('ADA', 'Cardano', 'crypto'),
  ('DOGE', 'Dogecoin', 'crypto'),
  ('DOT', 'Polkadot', 'crypto'),
  ('AVAX', 'Avalanche', 'crypto'),
  ('MATIC', 'Polygon', 'crypto'),
  ('LINK', 'Chainlink', 'crypto'),
  -- Stocks
  ('AAPL', 'Apple Inc.', 'stock'),
  ('TSLA', 'Tesla Inc.', 'stock'),
  ('NVDA', 'NVIDIA Corp.', 'stock'),
  ('AMZN', 'Amazon.com Inc.', 'stock'),
  ('GOOGL', 'Alphabet Inc.', 'stock'),
  ('MSFT', 'Microsoft Corp.', 'stock'),
  ('META', 'Meta Platforms', 'stock'),
  ('NFLX', 'Netflix Inc.', 'stock'),
  ('AMD', 'Advanced Micro Devices', 'stock'),
  ('JPM', 'JPMorgan Chase', 'stock'),
  -- Commodities
  ('GC=F', 'Gold', 'commodity'),
  ('CL=F', 'Crude Oil WTI', 'commodity'),
  ('SI=F', 'Silver', 'commodity'),
  ('NG=F', 'Natural Gas', 'commodity'),
  ('PL=F', 'Platinum', 'commodity'),
  -- Indexes
  ('^GSPC', 'S&P 500', 'index'),
  ('^IXIC', 'NASDAQ Composite', 'index'),
  ('^DJI', 'Dow Jones Industrial', 'index'),
  ('^RUT', 'Russell 2000', 'index')
ON CONFLICT (symbol) DO NOTHING;

-- =====================================================
-- DEFAULT PLATFORM SETTINGS
-- =====================================================
INSERT INTO platform_settings (key, value) VALUES
  ('default_balance', '10000000'),
  ('platform_name', 'Terra Invest VIP'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol);

-- =====================================================
-- ENABLE REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE positions;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;
