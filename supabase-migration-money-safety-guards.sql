-- Money safety guards: protect financial profile columns from direct client writes.
-- Run this in Supabase SQL Editor after deploying the API changes.

CREATE OR REPLACE FUNCTION public.prevent_unsafe_profile_financial_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  guarded_field text;
  guarded_fields text[] := ARRAY[
    'balance',
    'total_pnl',
    'role',
    'vip_level',
    'is_locked',
    'can_trade_crypto',
    'can_trade_stocks',
    'can_trade_indexes',
    'can_trade_commodities',
    'can_trade_forex',
    'can_trade_options',
    'can_view_order_book',
    'max_leverage'
  ];
BEGIN
  -- Server-side service-role operations are the only non-admin path allowed to
  -- move ledger-backed fields. Normal users should use vetted API routes.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO requester_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF requester_role = 'admin' THEN
    RETURN NEW;
  END IF;

  FOREACH guarded_field IN ARRAY guarded_fields LOOP
    IF to_jsonb(NEW) ? guarded_field
       AND (to_jsonb(NEW) -> guarded_field) IS DISTINCT FROM (to_jsonb(OLD) -> guarded_field) THEN
      RAISE EXCEPTION 'Direct updates to financial or privileged profile fields are not allowed';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unsafe_profile_financial_update ON public.profiles;
CREATE TRIGGER prevent_unsafe_profile_financial_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unsafe_profile_financial_update();

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'profiles_balance_nonnegative'
     ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_balance_nonnegative CHECK (balance >= 0) NOT VALID;
  END IF;

  IF to_regclass('public.deposit_history') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'deposit_history_amount_positive'
     ) THEN
    ALTER TABLE public.deposit_history
      ADD CONSTRAINT deposit_history_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;

  IF to_regclass('public.withdrawal_requests') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_amount_positive'
     ) THEN
    ALTER TABLE public.withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;
