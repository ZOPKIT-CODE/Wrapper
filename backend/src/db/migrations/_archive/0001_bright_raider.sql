ALTER TABLE "credit_configurations" ADD COLUMN "operation_name" varchar(255);--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "category" varchar(100);--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "free_allowance" integer;--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "free_allowance_period" varchar(20);--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "volume_tiers" varchar;--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "allow_overage" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "overage_limit" integer;--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "overage_period" varchar(20);--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "overage_cost" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "scope" varchar(20) DEFAULT 'global';--> statement-breakpoint
ALTER TABLE "credit_configurations" ADD COLUMN "priority" integer DEFAULT 100;