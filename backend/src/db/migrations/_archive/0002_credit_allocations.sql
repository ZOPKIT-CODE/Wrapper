-- Create credit allocations table for application-specific credit management
CREATE TABLE "credit_allocations" (
  "allocation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "source_entity_id" uuid NOT NULL,
  "target_application" varchar(50) NOT NULL,
  "allocated_credits" numeric(15, 4) NOT NULL,
  "used_credits" numeric(15, 4) DEFAULT '0' NOT NULL,
  "available_credits" numeric(15, 4) DEFAULT '0' NOT NULL,
  "allocation_type" varchar(30) DEFAULT 'manual' NOT NULL,
  "allocation_purpose" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "allocated_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  "auto_replenish" boolean DEFAULT false NOT NULL,
  "allocated_by" uuid,
  "last_updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("source_entity_id") REFERENCES "entities"("entity_id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("allocated_by") REFERENCES "tenant_users"("user_id") ON DELETE set null ON UPDATE no action,
  FOREIGN KEY ("updated_by") REFERENCES "tenant_users"("user_id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint

-- Create credit allocation transactions table for tracking allocation changes
CREATE TABLE "credit_allocation_transactions" (
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
  "created_at" timestamp DEFAULT now() NOT NULL,
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("allocation_id") REFERENCES "credit_allocations"("allocation_id") ON DELETE cascade ON UPDATE no action,
  FOREIGN KEY ("initiated_by") REFERENCES "tenant_users"("user_id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint

-- Create indexes for better performance
CREATE INDEX "credit_allocations_tenant_active_idx" ON "credit_allocations"("tenant_id", "is_active");--> statement-breakpoint
CREATE INDEX "credit_allocations_tenant_app_idx" ON "credit_allocations"("tenant_id", "target_application");--> statement-breakpoint
CREATE INDEX "credit_allocations_source_entity_idx" ON "credit_allocations"("source_entity_id");--> statement-breakpoint
CREATE INDEX "credit_allocation_transactions_allocation_idx" ON "credit_allocation_transactions"("allocation_id");--> statement-breakpoint
CREATE INDEX "credit_allocation_transactions_tenant_created_idx" ON "credit_allocation_transactions"("tenant_id", "created_at");--> statement-breakpoint

-- Add constraint to ensure available credits don't go negative
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_available_check" CHECK ("available_credits" >= 0);--> statement-breakpoint

-- Add constraint to ensure used credits don't exceed allocated credits
ALTER TABLE "credit_allocations" ADD CONSTRAINT "credit_allocations_used_check" CHECK ("used_credits" <= "allocated_credits");--> statement-breakpoint
