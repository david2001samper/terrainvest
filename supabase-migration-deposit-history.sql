-- Migration: Deposit history tracking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS deposit_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(20, 2) NOT NULL,
  note         TEXT,
  created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deposit_history_user_id_idx  ON deposit_history (user_id);
CREATE INDEX IF NOT EXISTS deposit_history_created_at_idx ON deposit_history (created_at DESC);

ALTER TABLE deposit_history ENABLE ROW LEVEL SECURITY;

-- Users can see their own deposit history
CREATE POLICY "Users can view own deposit history"
  ON deposit_history FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins can view all deposit history"
  ON deposit_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert deposit history"
  ON deposit_history FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete deposit history"
  ON deposit_history FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
