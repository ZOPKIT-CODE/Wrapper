-- Migration: credit_type_column
-- Adds credit_type to seasonal_credit_allocations so every credit batch —
-- whether from a seasonal campaign, a free admin grant, or a paid purchase —
-- is tagged with its origin. This drives FIFO allocation order and lets
-- downstream apps display "promotional", "purchased", or "free" labels.

ALTER TABLE seasonal_credit_allocations
  ADD COLUMN IF NOT EXISTS credit_type VARCHAR(20) DEFAULT 'free'
    CHECK (credit_type IN ('free', 'paid', 'seasonal'));
