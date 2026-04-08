-- Fix: mark-as-read updates may not persist without WITH CHECK on UPDATE (Postgres RLS).
-- Run in Supabase SQL Editor if clients still see read notifications as unread after refresh.

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
