-- Migration: Add wallet address to withdrawal requests
-- Run in Supabase SQL Editor

ALTER TABLE withdrawal_requests
  ADD COLUMN IF NOT EXISTS wallet_address TEXT;

COMMENT ON COLUMN withdrawal_requests.wallet_address IS 'Destination wallet/account address entered by the client';
