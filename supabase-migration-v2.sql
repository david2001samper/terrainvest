-- Terra Invest VIP - Migration v2
-- Run this in Supabase SQL Editor after the main schema

-- Add columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add fee_per_trade to platform_settings
INSERT INTO platform_settings (key, value) VALUES ('fee_per_trade', '0.10')
ON CONFLICT (key) DO NOTHING;

-- Orders table for pending limit/stop orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  order_type TEXT NOT NULL CHECK (order_type IN ('limit', 'stop', 'stop-limit')),
  quantity NUMERIC(20, 8) NOT NULL,
  limit_price NUMERIC(20, 8),
  stop_price NUMERIC(20, 8),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own orders" ON orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admin view all orders" ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin update all orders" ON orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Assets: custom display name and category
ALTER TABLE assets ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Platform settings: announcements and currency rates
INSERT INTO platform_settings (key, value) VALUES ('announcement', '')
ON CONFLICT (key) DO NOTHING;
INSERT INTO platform_settings (key, value) VALUES ('currency_rates', '{"EUR":0.92,"GBP":0.79,"CAD":1.35,"AUD":1.53}')
ON CONFLICT (key) DO NOTHING;

-- Allow anyone to read platform_settings (for announcement banner)
CREATE POLICY "Anyone can read platform_settings" ON platform_settings FOR SELECT USING (true);

-- Price overrides: admin can set temporary price overrides for symbols
CREATE TABLE IF NOT EXISTS price_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL UNIQUE,
  override_price NUMERIC(20, 8) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_overrides_symbol ON price_overrides(symbol);
CREATE INDEX IF NOT EXISTS idx_price_overrides_expires ON price_overrides(expires_at);

ALTER TABLE price_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active overrides" ON price_overrides FOR SELECT USING (expires_at > NOW());
CREATE POLICY "Admin manage overrides" ON price_overrides FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
