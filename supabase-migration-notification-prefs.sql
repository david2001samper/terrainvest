-- Migration: Notification preferences per user
-- Run in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_withdrawal BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_deposit BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN profiles.notify_withdrawal IS 'In-app notification on withdrawal status change';
COMMENT ON COLUMN profiles.notify_deposit IS 'In-app notification on deposit confirmation';
