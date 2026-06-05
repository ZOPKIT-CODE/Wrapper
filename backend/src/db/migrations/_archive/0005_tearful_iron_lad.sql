CREATE TABLE IF NOT EXISTS "notifications" (
	"notification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"action_url" text,
	"action_label" text,
	"metadata" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"scheduled_at" timestamp,
	"target_user_id" uuid
);
--> statement-breakpoint
-- Alter credit_type column if it exists and is not already varchar(50)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_allocations'
        AND column_name = 'credit_type'
        AND data_type != 'character varying'
    ) THEN
        ALTER TABLE "credit_allocations" ALTER COLUMN "credit_type" SET DATA TYPE varchar(50);
    END IF;
END $$;

-- Add credit_metadata column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_allocations'
        AND column_name = 'credit_metadata'
    ) THEN
        ALTER TABLE "credit_allocations" ADD COLUMN "credit_metadata" jsonb;
    END IF;
END $$;

-- Add campaign_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_allocations'
        AND column_name = 'campaign_id'
    ) THEN
        ALTER TABLE "credit_allocations" ADD COLUMN "campaign_id" varchar(100);
    END IF;
END $$;

-- Add campaign_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_allocations'
        AND column_name = 'campaign_name'
    ) THEN
        ALTER TABLE "credit_allocations" ADD COLUMN "campaign_name" varchar(255);
    END IF;
END $$;

-- Add expiry_rule column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_allocations'
        AND column_name = 'expiry_rule'
    ) THEN
        ALTER TABLE "credit_allocations" ADD COLUMN "expiry_rule" varchar(50) DEFAULT 'fixed_date';
    END IF;
END $$;

-- Add expiry_warning_days column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_allocations'
        AND column_name = 'expiry_warning_days'
    ) THEN
        ALTER TABLE "credit_allocations" ADD COLUMN "expiry_warning_days" numeric(5, 0) DEFAULT '7';
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
