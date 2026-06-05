-- fix_012: Drop credit_usage table (unused — credit tracking moved to credit_transactions ledger).
--
-- ROLLBACK: Recreate from billing/credit_usage.ts schema if needed.

DROP TABLE IF EXISTS credit_usage;
