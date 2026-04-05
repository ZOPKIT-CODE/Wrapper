-- Restore refund columns (dropped in 0004, restore migration 0006 may not have run).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS amount_refunded numeric(10, 2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS refund_reason varchar(100),
  ADD COLUMN IF NOT EXISTS is_partial_refund boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at timestamp;

-- Add a provider column to distinguish Stripe vs Razorpay payments.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'stripe';

-- Prevent duplicate payment records from concurrent webhook deliveries.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_unique
  ON payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_provider
  ON payments (provider);
