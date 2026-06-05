CREATE TABLE IF NOT EXISTS "event_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"tenant_id" varchar(255) NOT NULL,
	"entity_id" varchar(255),
	"stream_key" varchar(100) NOT NULL,
	"source_application" varchar(50) NOT NULL,
	"target_application" varchar(50) NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"published_by" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(50) NOT NULL,
	"error_message" text,
	"is_retryable" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "event_tracking_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
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
CREATE INDEX IF NOT EXISTS "event_tracking_event_id_idx" ON "event_tracking" ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_tracking_event_type_idx" ON "event_tracking" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_tracking_tenant_id_idx" ON "event_tracking" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_tracking_status_idx" ON "event_tracking" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_tracking_created_at_idx" ON "event_tracking" ("created_at");--> statement-breakpoint
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
