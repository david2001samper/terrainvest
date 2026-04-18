-- Security hardening for public settings, override visibility, and forex cleanup

-- Replace broad public read access on platform settings with scoped policies.
DROP POLICY IF EXISTS "Anyone can read platform_settings" ON platform_settings;
DROP POLICY IF EXISTS "Public can read safe platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Authenticated users can read deposit settings" ON platform_settings;

CREATE POLICY "Public can read safe platform settings" ON platform_settings
  FOR SELECT USING (
    key IN ('announcement', 'currency_rates', 'fee_per_trade', 'default_balance')
  );

CREATE POLICY "Authenticated users can read deposit settings" ON platform_settings
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND key IN ('wallet_btc', 'wallet_usdt', 'order_book_cache_minutes')
  );

-- Limit visibility of active price overrides to authenticated users.
DROP POLICY IF EXISTS "Anyone can read active overrides" ON price_overrides;
DROP POLICY IF EXISTS "Authenticated users can read active overrides" ON price_overrides;

CREATE POLICY "Authenticated users can read active overrides" ON price_overrides
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND expires_at > NOW()
  );

-- Allow users to fully close their own forex positions when netting reaches zero.
DROP POLICY IF EXISTS "Users can delete own forex positions" ON forex_positions;

CREATE POLICY "Users can delete own forex positions" ON forex_positions
  FOR DELETE USING (auth.uid() = user_id);
