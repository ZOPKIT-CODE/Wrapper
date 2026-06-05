-- Add credit_type to credit_batches (FIFO + expiry labeling).
-- Safe if already present (IF NOT EXISTS).

ALTER TABLE credit_batches
  ADD COLUMN IF NOT EXISTS credit_type VARCHAR(20) DEFAULT 'free'
  CHECK (credit_type IN ('free', 'paid', 'seasonal'));
