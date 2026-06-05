-- M010: Rename credit_purchases.payment_status to payment_status_deprecated.
-- Pre-flight: 0 rows where status != payment_status confirmed.
-- Using a rename (not a drop) as a two-step safety approach:
--   Step 1 (this file): rename → any query still referencing payment_status
--                       will fail visibly at the query layer, not silently.
--   Step 2 (fix_010b): after confirming no query errors in logs for 1 sprint,
--                       DROP COLUMN payment_status_deprecated.
--
-- ROLLBACK:
--   ALTER TABLE credit_purchases
--     RENAME COLUMN payment_status_deprecated TO payment_status;

ALTER TABLE credit_purchases
  RENAME COLUMN payment_status TO payment_status_deprecated;
