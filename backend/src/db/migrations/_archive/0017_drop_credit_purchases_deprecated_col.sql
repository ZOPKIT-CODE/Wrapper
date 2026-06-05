-- Drop the payment_status_deprecated column from credit_purchases.
-- This was renamed to `status` in a prior migration; the old column was
-- retained for backward-compatibility but is no longer referenced anywhere.
ALTER TABLE "credit_purchases" DROP COLUMN IF EXISTS "payment_status_deprecated";
