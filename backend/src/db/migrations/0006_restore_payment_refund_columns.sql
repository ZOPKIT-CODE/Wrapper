ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "amount_refunded" numeric(10, 2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS "refund_reason" varchar(100),
  ADD COLUMN IF NOT EXISTS "is_partial_refund" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "refunded_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "provider" varchar(20) DEFAULT 'stripe';
