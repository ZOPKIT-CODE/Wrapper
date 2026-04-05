-- Convert subscription timestamps to timestamptz for correct timezone handling.
-- This is safe: Postgres interprets existing timestamp values as local time and converts.
ALTER TABLE subscriptions
  ALTER COLUMN current_period_start TYPE timestamptz USING current_period_start AT TIME ZONE 'UTC',
  ALTER COLUMN current_period_end TYPE timestamptz USING current_period_end AT TIME ZONE 'UTC',
  ALTER COLUMN cancel_at TYPE timestamptz USING cancel_at AT TIME ZONE 'UTC',
  ALTER COLUMN canceled_at TYPE timestamptz USING canceled_at AT TIME ZONE 'UTC',
  ALTER COLUMN suspended_at TYPE timestamptz USING suspended_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE payments
  ALTER COLUMN paid_at TYPE timestamptz USING paid_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
