-- Migration: IBKR features — order book permission + cache setting
-- Run in Supabase SQL Editor

-- Per-user order book permission (admin-granted)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_view_order_book BOOLEAN NOT NULL DEFAULT FALSE;

-- Order book cache duration (minutes) in platform settings
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('order_book_cache_minutes', '5', NOW())
ON CONFLICT (key) DO NOTHING;
