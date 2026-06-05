-- Fix expires_at columns to use TIMESTAMPTZ instead of TIMESTAMP WITHOUT TIME ZONE.
-- Root cause: Drizzle schema declared withTimezone: true but migrations were never applied.
-- This caused a timezone mismatch:
--   - credit_batches.expires_at was stored in UTC (raw)
--   - seasonal_credit_campaigns.expires_at was stored in local time (IST)
-- Result: batches expired immediately because SQL compared UTC values against local-time NOW().

ALTER TABLE credit_batches
  ALTER COLUMN expires_at TYPE timestamptz
  USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE seasonal_credit_campaigns
  ALTER COLUMN expires_at TYPE timestamptz
  USING expires_at AT TIME ZONE 'Asia/Kolkata';
