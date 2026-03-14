-- Migration: Use platform_settings.default_balance for new user signups
-- Run this in Supabase SQL Editor to fix the default balance issue.
-- After running, new users will get the balance set in Admin → Settings.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_bal NUMERIC := 0;
BEGIN
  SELECT COALESCE(
    NULLIF(TRIM(value), '')::numeric,
    0
  ) INTO default_bal
  FROM platform_settings
  WHERE key = 'default_balance'
  LIMIT 1;

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
