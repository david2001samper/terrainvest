-- Migration: Leads capture table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS leads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  phone         TEXT,
  country_code  TEXT,
  country       TEXT,
  investment_range TEXT,
  message       TEXT,
  source        TEXT        NOT NULL DEFAULT 'landing_page',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS leads_email_idx       ON leads (email);
CREATE INDEX IF NOT EXISTS leads_created_at_idx  ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_country_idx     ON leads (country_code);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (for the public leads form)
CREATE POLICY "Anyone can submit a lead"
  ON leads FOR INSERT
  WITH CHECK (true);

-- Only authenticated admins can read
CREATE POLICY "Admins can read leads"
  ON leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Only authenticated admins can delete
CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
