-- Migration: Add user approval system
-- New users default to is_approved = false; admins must approve them.
-- Run in Supabase SQL Editor.

-- 1. Add column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- 2. Approve all existing users so they are not locked out
UPDATE profiles SET is_approved = true WHERE is_approved = false;

-- 3. Recreate trigger so new signups default to unapproved (admins auto-approved)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_bal NUMERIC := 0;
  is_admin BOOLEAN := false;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(TRIM(value), '')::numeric, 0) INTO default_bal
    FROM public.platform_settings
    WHERE key = 'default_balance'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    default_bal := 0;
  END;

  is_admin := (NEW.email = 'admin@terrainvestvip.com');

  INSERT INTO public.profiles (id, email, display_name, phone_e164, role, balance, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'phone_e164',
    CASE WHEN is_admin THEN 'admin' ELSE 'user' END,
    COALESCE(default_bal, 0),
    is_admin  -- admins are auto-approved, regular users are not
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RAISE;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
