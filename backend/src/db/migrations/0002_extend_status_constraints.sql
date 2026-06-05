-- Extend the payment/subscription status CHECK constraints to cover the FULL
-- vocabulary the application actually writes.
--
-- The prior constraints came from the ad-hoc `fix_008_enum_check_constraints` script,
-- which was applied to production but never recorded in the migration journal — so the
-- shim-built test DB never had it and the mismatch stayed hidden until the baseline
-- (a faithful pg_dump of prod) brought the real constraints into the test DB.
--
-- The app's de-facto canonical payment status is `succeeded` (written AND queried across
-- ~10 files), plus `partially_refunded` / `disputed`; subscriptions use `suspended`
-- (trial suspension). The old constraints rejected all of these. prod's `payments` table
-- is empty (0 rows) so it never fired, but the first real payment/refund/trial-suspension
-- would have. Loosening a CHECK is additive and safe (no existing row can violate a superset).
--
-- Both spellings of cancel(l)ed are allowed because the app is internally inconsistent
-- (`canceled` in code vs `cancelled` in the old constraint); normalizing that spelling is
-- a separate app-level cleanup, intentionally NOT bundled into this schema baseline.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_status;
ALTER TABLE payments ADD CONSTRAINT chk_payment_status CHECK (
  status IN (
    'pending', 'processing', 'completed', 'succeeded', 'failed',
    'cancelled', 'canceled', 'refunded', 'partially_refunded', 'disputed'
  )
);

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS chk_subscription_status;
ALTER TABLE subscriptions ADD CONSTRAINT chk_subscription_status CHECK (
  status IN (
    'active', 'inactive', 'trialing', 'trial', 'past_due',
    'canceled', 'cancelled', 'paused', 'suspended'
  )
);
