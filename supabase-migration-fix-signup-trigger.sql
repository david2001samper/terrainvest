-- Migration: Fix "Database error saving new user" on signup
-- Run in Supabase SQL Editor
-- This makes the handle_new_user trigger more robust and ensures it can insert into profiles.

-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function with explicit search_path and robust error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_bal NUMERIC := 0;
BEGIN
  -- Safely get default_balance from platform_settings (may not exist yet)
  BEGIN
    SELECT COALESCE(NULLIF(TRIM(value), '')::numeric, 0) INTO default_bal
    FROM public.platform_settings
    WHERE key = 'default_balance'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    default_bal := 0;
  END;

  INSERT INTO public.profiles (id, email, display_name, role, balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    CASE WHEN NEW.email = 'admin@terrainvestvip.com' THEN 'admin' ELSE 'user' END,
    COALESCE(default_bal, 0)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RAISE;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure platform_settings has default_balance (required by trigger)
INSERT INTO platform_settings (key, value) VALUES ('default_balance', '10000000')
ON CONFLICT (key) DO NOTHING;
