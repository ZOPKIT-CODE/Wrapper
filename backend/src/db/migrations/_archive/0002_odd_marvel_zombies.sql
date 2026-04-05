CREATE TABLE IF NOT EXISTS "credit_allocation_transactions" (
	"transaction_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"transaction_type" varchar(30) NOT NULL,
	"amount" numeric(15, 4) NOT NULL,
	"previous_allocated" numeric(15, 4),
	"new_allocated" numeric(15, 4),
	"previous_used" numeric(15, 4),
	"new_used" numeric(15, 4),
	"operation_code" varchar(255),
	"description" text,
	"initiated_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_allocations" (
	"allocation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_application" varchar(50) NOT NULL,
	"allocated_credits" numeric(15, 4) NOT NULL,
	"used_credits" numeric(15, 4) DEFAULT '0',
	"available_credits" numeric(15, 4) DEFAULT '0',
	"allocation_type" varchar(30) DEFAULT 'manual',
	"allocation_purpose" text,
	"is_active" boolean DEFAULT true,
	"allocated_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"auto_replenish" boolean DEFAULT false,
	"allocated_by" uuid,
	"last_updated_at" timestamp DEFAULT now(),
	"updated_by" uuid
);
--> statement-breakpoint
-- Add columns only if they don't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_invitations' AND column_name = 'target_entities') THEN
        ALTER TABLE "tenant_invitations" ADD COLUMN "target_entities" jsonb DEFAULT '[]'::jsonb;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_invitations' AND column_name = 'invitation_scope') THEN
        ALTER TABLE "tenant_invitations" ADD COLUMN "invitation_scope" varchar(20) DEFAULT 'tenant';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_invitations' AND column_name = 'primary_entity_id') THEN
        ALTER TABLE "tenant_invitations" ADD COLUMN "primary_entity_id" uuid;
    END IF;
END $$;

--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_allocation_transactions" ADD CONSTRAINT "credit_allocation_transactions_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_allocation_transactions" ADD CONSTRAINT "credit_allocation_transactions_allocation_id_credit_allocations_allocation_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "credit_allocations"("allocation_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_allocation_transactions" ADD CONSTRAINT "credit_allocation_transactions_initiated_by_tenant_users_user_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_source_entity_id_entities_entity_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_allocated_by_tenant_users_user_id_fk" FOREIGN KEY ("allocated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_updated_by_tenant_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
