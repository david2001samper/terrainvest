-- Migration: Phone on profiles (E.164), unique when set, and signup trigger
-- Run in Supabase SQL Editor after prior migrations.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_e164_unique
  ON public.profiles (phone_e164)
  WHERE phone_e164 IS NOT NULL AND btrim(phone_e164) <> '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_bal NUMERIC := 0;
  meta_phone TEXT;
BEGIN
  BEGIN
    SELECT COALESCE(NULLIF(TRIM(value), '')::numeric, 0) INTO default_bal
    FROM public.platform_settings
    WHERE key = 'default_balance'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    default_bal := 0;
  END;

  meta_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone_e164', '')), '');

  INSERT INTO public.profiles (id, email, display_name, role, balance, phone_e164)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    CASE WHEN NEW.email = 'admin@terrainvestvip.com' THEN 'admin' ELSE 'user' END,
    COALESCE(default_bal, 0),
    meta_phone
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
