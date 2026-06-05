ALTER TABLE "payments" DROP CONSTRAINT "payments_refund_requested_by_tenants_tenant_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_entity_id_entities_entity_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_parent_entity_id_entities_entity_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_allocations" ADD COLUMN "credit_type" varchar(20) DEFAULT 'free';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_applications_tenant_app_unique" ON "organization_applications" ("tenant_id","app_id");--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "stripe_refund_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "stripe_dispute_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "amount_refunded";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "amount_disputed";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "proration_amount";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "credit_amount";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "refund_reason";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "refund_requested_by";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "is_partial_refund";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "dispute_reason";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "dispute_status";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "dispute_evidence_submitted";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "tax_rate";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "tax_region";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "processing_fees";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "net_amount";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "risk_level";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "risk_score";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "fraud_details";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "failed_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "refunded_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "disputed_at";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN IF EXISTS "settled_at";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "entity_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "parent_entity_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "billing_entity_type";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_price_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "trial_start";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "trial_end";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "first_upgrade_at";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "last_downgrade_at";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "trial_toggled_off";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "last_reminder_sent_at";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "reminder_count";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "restrictions_applied_at";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "billing_model";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "credit_allocation";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "overage_limits";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "discount_tiers_key";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "monthly_price";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "add_ons";--> statement-breakpoint
ALTER TABLE "credits" DROP COLUMN IF EXISTS "reserved_credits";