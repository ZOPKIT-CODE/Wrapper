-- Remove unused fields from database tables
-- Migration: 0005_remove_unused_fields.sql

-- Remove unused fields from subscriptions table
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "entity_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "parent_entity_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "billing_entity_type";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_price_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "trial_start";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "trial_end";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "first_upgrade_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "last_downgrade_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "trial_toggled_off";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "last_reminder_sent_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "reminder_count";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "restrictions_applied_at";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "billing_model";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "credit_allocation";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "overage_limits";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "discount_tiers_key";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "monthly_price";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "add_ons";

-- Remove unused fields from credits table
ALTER TABLE "credits" DROP COLUMN IF EXISTS "reserved_credits";

-- Remove unused fields from payments table
ALTER TABLE "payments" DROP COLUMN IF EXISTS "amount_refunded";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "amount_disputed";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "stripe_refund_id";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "stripe_dispute_id";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "refund_reason";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "refund_requested_by";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "is_partial_refund";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "dispute_reason";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "dispute_status";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "dispute_evidence_submitted";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "disputed_at";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "settled_at";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "failed_at";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "refunded_at";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "risk_level";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "risk_score";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "fraud_details";
