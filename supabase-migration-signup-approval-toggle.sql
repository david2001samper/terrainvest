-- Migration: Signup approval toggle (default OFF)
-- Run in Supabase SQL Editor for existing deployments.

-- 1) Add configurable toggle key with default disabled.
INSERT INTO platform_settings (key, value)
VALUES ('signup_approval_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 2) Recreate trigger function so new users are auto-approved when toggle is off.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_bal NUMERIC := 0;
  admin_addr TEXT := 'admin@terrainvestvip.com';
  require_approval BOOLEAN := false;
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

  BEGIN
    SELECT COALESCE(NULLIF(TRIM(value), ''), 'admin@terrainvestvip.com') INTO admin_addr
    FROM public.platform_settings
    WHERE key = 'admin_email'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    admin_addr := 'admin@terrainvestvip.com';
  END;

  BEGIN
    SELECT COALESCE(LOWER(TRIM(value)) IN ('true', '1', 'yes', 'on'), false)
    INTO require_approval
    FROM public.platform_settings
    WHERE key = 'signup_approval_enabled'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    require_approval := false;
  END;

  is_admin := (NEW.email = admin_addr);

  INSERT INTO public.profiles (id, email, display_name, phone_e164, role, balance, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.raw_user_meta_data->>'phone_e164',
    CASE WHEN is_admin THEN 'admin' ELSE 'user' END,
    COALESCE(default_bal, 0),
    CASE
      WHEN is_admin THEN true
      WHEN require_approval THEN false
      ELSE true
    END
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RAISE;
END;
$$;

-- 3) If approval is currently disabled, unlock all pending users now.
UPDATE profiles
SET is_approved = true, updated_at = now()
WHERE role = 'user'
  AND is_approved = false
  AND EXISTS (
    SELECT 1
    FROM platform_settings
    WHERE key = 'signup_approval_enabled'
      AND COALESCE(LOWER(TRIM(value)) IN ('true', '1', 'yes', 'on'), false) = false
  );
