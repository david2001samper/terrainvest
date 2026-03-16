-- Migration: Login logs
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS login_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own login logs" ON login_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own login logs" ON login_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all login logs" ON login_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_login_logs_user_id_created
  ON login_logs(user_id, created_at DESC);

