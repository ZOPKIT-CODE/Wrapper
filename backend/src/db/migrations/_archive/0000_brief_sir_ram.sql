CREATE TABLE IF NOT EXISTS "onboarding_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_phase" varchar(50) NOT NULL,
	"event_action" varchar(50) NOT NULL,
	"user_id" uuid,
	"session_id" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"time_spent" integer,
	"completion_rate" integer,
	"step_number" integer,
	"total_steps" integer,
	"variant_id" varchar(50),
	"experiment_id" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"event_timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_invitations" (
	"invitation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role_id" uuid,
	"invited_by" uuid NOT NULL,
	"invitation_token" varchar(255) NOT NULL,
	"invitation_url" varchar(1000),
	"status" varchar(20) DEFAULT 'pending',
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"cancelled_at" timestamp,
	"cancelled_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenant_invitations_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"tenant_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"subdomain" varchar(100) NOT NULL,
	"kinde_org_id" varchar(255) NOT NULL,
	"admin_email" varchar(255) NOT NULL,
	"legal_company_name" varchar(255),
	"gstin" varchar(15),
	"company_type" varchar(100),
	"industry" varchar(100),
	"website" varchar(500),
	"billing_street" varchar(255),
	"billing_city" varchar(100),
	"billing_state" varchar(100),
	"billing_zip" varchar(20),
	"billing_country" varchar(100),
	"phone" varchar(50),
	"default_language" varchar(10) DEFAULT 'en',
	"default_locale" varchar(20) DEFAULT 'en-US',
	"default_currency" varchar(3) DEFAULT 'USD',
	"default_timezone" varchar(50) DEFAULT 'UTC',
	"logo_url" varchar(500),
	"primary_color" varchar(7) DEFAULT '#2563eb',
	"custom_domain" varchar(255),
	"branding_config" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"stripe_customer_id" varchar(255),
	"onboarding_completed" boolean DEFAULT false,
	"onboarded_at" timestamp,
	"onboarding_started_at" timestamp,
	"trial_ends_at" timestamp,
	"trial_started_at" timestamp,
	"first_login_at" timestamp,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_subdomain_unique" UNIQUE("subdomain"),
	CONSTRAINT "tenants_kinde_org_id_unique" UNIQUE("kinde_org_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"location_id" uuid,
	"entity_type" varchar(20) DEFAULT 'organization',
	"access_level" varchar(20) DEFAULT 'direct',
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(255),
	"old_values" jsonb,
	"new_values" jsonb,
	"details" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kinde_user_id" varchar(255),
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"username" varchar(100),
	"avatar" varchar(500),
	"title" varchar(100),
	"department" varchar(100),
	"alias" varchar(100),
	"phone" varchar(50),
	"mobile" varchar(50),
	"profile_data" jsonb DEFAULT '{}'::jsonb,
	"primary_organization_id" uuid,
	"is_responsible_person" boolean DEFAULT false,
	"admin_privileges" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"is_tenant_admin" boolean DEFAULT false,
	"invited_at" timestamp,
	"last_active_at" timestamp,
	"last_login_at" timestamp,
	"login_count" integer DEFAULT 0,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"onboarding_completed" boolean DEFAULT false,
	"onboarding_step" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_manager_relationships" (
	"relationship_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"relationship_type" varchar(50) DEFAULT 'direct',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"login_at" timestamp DEFAULT now(),
	"last_activity_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid,
	"stripe_payment_intent_id" varchar(255),
	"stripe_invoice_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"stripe_refund_id" varchar(255),
	"stripe_dispute_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"amount_refunded" numeric(10, 2) DEFAULT '0',
	"amount_disputed" numeric(10, 2) DEFAULT '0',
	"currency" varchar(3) DEFAULT 'USD',
	"status" varchar(20) NOT NULL,
	"payment_method" varchar(50),
	"payment_method_details" jsonb DEFAULT '{}'::jsonb,
	"payment_type" varchar(30) DEFAULT 'subscription',
	"billing_reason" varchar(50),
	"invoice_number" varchar(50),
	"description" text,
	"proration_amount" numeric(10, 2) DEFAULT '0',
	"credit_amount" numeric(10, 2) DEFAULT '0',
	"refund_reason" varchar(100),
	"refund_requested_by" uuid,
	"is_partial_refund" boolean DEFAULT false,
	"dispute_reason" varchar(100),
	"dispute_status" varchar(30),
	"dispute_evidence_submitted" boolean DEFAULT false,
	"tax_amount" numeric(10, 2) DEFAULT '0',
	"tax_rate" numeric(5, 4) DEFAULT '0',
	"tax_region" varchar(50),
	"processing_fees" numeric(10, 2) DEFAULT '0',
	"net_amount" numeric(10, 2),
	"risk_level" varchar(20),
	"risk_score" integer,
	"fraud_details" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"stripe_raw_data" jsonb DEFAULT '{}'::jsonb,
	"paid_at" timestamp,
	"failed_at" timestamp,
	"refunded_at" timestamp,
	"disputed_at" timestamp,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"subscription_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"parent_entity_id" uuid,
	"billing_entity_type" varchar(20) DEFAULT 'organization',
	"plan" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"stripe_subscription_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"stripe_price_id" varchar(255),
	"trial_start" timestamp,
	"trial_end" timestamp,
	"is_trial_user" boolean DEFAULT false,
	"has_ever_upgraded" boolean DEFAULT false,
	"first_upgrade_at" timestamp,
	"last_downgrade_at" timestamp,
	"trial_toggled_off" boolean DEFAULT false,
	"last_reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0,
	"restrictions_applied_at" timestamp,
	"billing_model" varchar(20) DEFAULT 'bulk_then_per_usage',
	"credit_allocation" jsonb DEFAULT '{}'::jsonb,
	"overage_limits" jsonb DEFAULT '{"period":"day","maxOps":10000,"allowOverage":true}'::jsonb,
	"discount_tiers_key" varchar(100),
	"subscribed_tools" jsonb DEFAULT '[]'::jsonb,
	"usage_limits" jsonb DEFAULT '{}'::jsonb,
	"billing_cycle" varchar(20) DEFAULT 'monthly',
	"monthly_price" numeric(10, 2) DEFAULT '0',
	"yearly_price" numeric(10, 2) DEFAULT '0',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at" timestamp,
	"canceled_at" timestamp,
	"suspended_at" timestamp,
	"suspended_reason" text,
	"add_ons" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_roles" (
	"role_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid,
	"location_id" uuid,
	"scope" varchar(20) DEFAULT 'organization',
	"is_inheritable" boolean DEFAULT true,
	"parent_role_id" uuid,
	"role_name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#6b7280',
	"kinde_role_id" varchar(255),
	"kinde_role_key" varchar(255),
	"permissions" jsonb NOT NULL,
	"restrictions" jsonb DEFAULT '{}'::jsonb,
	"is_system_role" boolean DEFAULT false,
	"is_default" boolean DEFAULT false,
	"priority" integer DEFAULT 0,
	"created_by" uuid NOT NULL,
	"last_modified_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"organization_id" uuid,
	"location_id" uuid,
	"scope" varchar(20) DEFAULT 'organization',
	"is_responsible_person" boolean DEFAULT false,
	"inherited_from" uuid,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"is_temporary" boolean DEFAULT false,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"deactivated_at" timestamp,
	"deactivated_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_logs" (
	"log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"location_id" uuid,
	"app" varchar(50) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer,
	"response_time" numeric(8, 2),
	"source" varchar(50) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"operation_code" varchar(255),
	"credit_consumed" numeric(10, 4) DEFAULT '0',
	"credit_batch_id" uuid,
	"pricing_mode" varchar(20) DEFAULT 'credits',
	"request_size" integer,
	"response_size" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"error_message" text,
	"error_stack" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_metrics_daily" (
	"metric_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid,
	"location_id" uuid,
	"app" varchar(50) NOT NULL,
	"date" timestamp NOT NULL,
	"api_calls" integer DEFAULT 0,
	"storage_used" numeric(15, 2) DEFAULT '0',
	"active_users" integer DEFAULT 0,
	"total_requests" integer DEFAULT 0,
	"credit_consumed" numeric(15, 4) DEFAULT '0',
	"credit_batches_used" jsonb DEFAULT '[]'::jsonb,
	"avg_response_time" numeric(8, 2) DEFAULT '0',
	"error_count" integer DEFAULT 0,
	"feature_usage" jsonb DEFAULT '{}'::jsonb,
	"usage_by_source" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "application_modules" (
	"module_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" uuid,
	"module_code" varchar(50) NOT NULL,
	"module_name" varchar(100) NOT NULL,
	"description" text,
	"is_core" boolean DEFAULT false,
	"permissions" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "applications" (
	"app_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_code" varchar(50) NOT NULL,
	"app_name" varchar(100) NOT NULL,
	"description" text,
	"icon" varchar(255),
	"base_url" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"version" varchar(20),
	"is_core" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "applications_app_code_unique" UNIQUE("app_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"app_id" uuid,
	"is_enabled" boolean DEFAULT true,
	"enabled_modules" jsonb,
	"custom_permissions" jsonb,
	"license_count" integer DEFAULT 0,
	"max_users" integer,
	"subscription_tier" varchar(50),
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_application_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"tenant_id" uuid,
	"app_id" uuid,
	"module_id" uuid,
	"permissions" jsonb,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"granted_by" uuid,
	"granted_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"status" varchar(50) NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "webhook_logs_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entities" (
	"entity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"parent_entity_id" uuid,
	"entity_level" integer DEFAULT 1,
	"entity_name" varchar(255) NOT NULL,
	"entity_code" varchar(50),
	"description" text,
	"organization_type" varchar(20),
	"location_type" varchar(20),
	"department_type" varchar(20),
	"team_type" varchar(20),
	"address" jsonb,
	"coordinates" jsonb,
	"business_hours" jsonb,
	"capacity" jsonb,
	"timezone" varchar(50) DEFAULT 'UTC',
	"currency" varchar(3) DEFAULT 'USD',
	"language" varchar(10) DEFAULT 'en',
	"logo_url" varchar(500),
	"primary_color" varchar(7),
	"branding_config" jsonb DEFAULT '{}'::jsonb,
	"responsible_person_id" uuid,
	"credit_allocation" numeric(15, 4) DEFAULT '0',
	"credit_policy" jsonb DEFAULT '{"allowCreditAllocation":true,"maxCreditAllocation":null,"creditExpiryPolicy":{"enabled":true,"defaultDays":365},"allowOverage":true,"overageLimit":10000,"overagePeriod":"day"}'::jsonb,
	"inherit_settings" boolean DEFAULT true,
	"inherit_branding" boolean DEFAULT true,
	"inherit_credits" boolean DEFAULT false,
	"settings" jsonb DEFAULT '{"notifications":true,"autoBackup":true,"features":{}}'::jsonb,
	"is_active" boolean DEFAULT true,
	"is_default" boolean DEFAULT false,
	"is_headquarters" boolean DEFAULT false,
	"onboarding_completed" boolean DEFAULT false,
	"onboarded_at" timestamp,
	"hierarchy_path" text,
	"full_hierarchy_path" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "entities_entity_code_unique" UNIQUE("entity_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"entity_id" uuid,
	"change_type" varchar(50) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"change_reason" text,
	"changed_by" uuid NOT NULL,
	"change_source" varchar(50) DEFAULT 'manual',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "membership_invitations" (
	"invitation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid,
	"invited_user_id" uuid,
	"invited_email" varchar(255) NOT NULL,
	"invitation_token" varchar(255) NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" varchar(20) DEFAULT 'organization',
	"role_id" uuid,
	"status" varchar(20) DEFAULT 'pending',
	"sent_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"cancelled_at" timestamp,
	"message" text,
	"invitation_url" varchar(1000),
	"invited_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "membership_invitations_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_memberships" (
	"membership_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" varchar(20) DEFAULT 'organization',
	"role_id" uuid,
	"role_name" varchar(100),
	"permissions" jsonb DEFAULT '{}'::jsonb,
	"membership_type" varchar(20) DEFAULT 'direct',
	"membership_status" varchar(20) DEFAULT 'active',
	"access_level" varchar(20) DEFAULT 'standard',
	"is_primary" boolean DEFAULT false,
	"can_access_sub_entities" boolean DEFAULT false,
	"credit_permissions" jsonb DEFAULT '{"canPurchaseCredits":false,"canTransferCredits":false,"canApproveTransfers":false,"canViewCreditUsage":true,"creditLimit":null}'::jsonb,
	"is_temporary" boolean DEFAULT false,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"timezone" varchar(50) DEFAULT 'UTC',
	"department" varchar(100),
	"team" varchar(100),
	"job_title" varchar(100),
	"employee_id" varchar(50),
	"contact_override" jsonb DEFAULT '{}'::jsonb,
	"preferences" jsonb DEFAULT '{"notifications":{"email":true,"sms":false,"push":true},"dashboard":{"theme":"default","layout":"standard"}}'::jsonb,
	"invited_by" uuid,
	"invited_at" timestamp,
	"joined_at" timestamp,
	"last_accessed_at" timestamp,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_transactions" (
	"transaction_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"transaction_type" varchar(30) NOT NULL,
	"amount" numeric(15, 4) NOT NULL,
	"previous_balance" numeric(15, 4),
	"new_balance" numeric(15, 4),
	"operation_code" varchar(255),
	"initiated_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credits" (
	"credit_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"available_credits" numeric(15, 4) DEFAULT '0',
	"reserved_credits" numeric(15, 4) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"last_updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_purchases" (
	"purchase_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid,
	"credit_amount" numeric(15, 4) NOT NULL,
	"unit_price" numeric(10, 4) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"batch_id" uuid NOT NULL,
	"expiry_date" timestamp,
	"payment_method" varchar(50),
	"stripe_payment_intent_id" varchar(255),
	"payment_status" varchar(20) DEFAULT 'pending',
	"status" varchar(20) DEFAULT 'pending',
	"requested_at" timestamp DEFAULT now(),
	"paid_at" timestamp,
	"credited_at" timestamp,
	"requested_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "credit_purchases_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_usage" (
	"usage_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"user_id" uuid,
	"operation_code" varchar(255) NOT NULL,
	"operation_id" uuid,
	"credits_debited" numeric(10, 4) NOT NULL,
	"ip_address" varchar(45),
	"request_id" varchar(100),
	"success" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_configurations" (
	"config_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"operation_code" varchar(255) NOT NULL,
	"is_global" boolean DEFAULT true,
	"credit_cost" numeric(10, 4) NOT NULL,
	"unit" varchar(20) DEFAULT 'operation',
	"unit_multiplier" numeric(10, 4) DEFAULT '1',
	"is_active" boolean DEFAULT true,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "responsibility_history" (
	"history_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"change_reason" text,
	"changed_by" uuid NOT NULL,
	"change_source" varchar(50) DEFAULT 'manual',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "responsibility_notifications" (
	"notification_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"action_required" varchar(100),
	"action_url" varchar(500),
	"action_deadline" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"status" varchar(20) DEFAULT 'pending',
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"next_retry_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "responsible_persons" (
	"assignment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" uuid,
	"user_id" uuid NOT NULL,
	"responsibility_level" varchar(20) DEFAULT 'primary',
	"scope" jsonb DEFAULT '{"creditManagement":true,"userManagement":true,"auditAccess":true,"configurationManagement":true,"reportingAccess":true}'::jsonb,
	"auto_permissions" jsonb DEFAULT '{"canApproveTransfers":true,"canPurchaseCredits":true,"canManageUsers":true,"canViewAllAuditLogs":true,"canConfigureEntity":true,"canGenerateReports":true}'::jsonb,
	"notification_preferences" jsonb DEFAULT '{"creditAlerts":true,"userActivities":true,"systemAlerts":true,"weeklyReports":true,"monthlyReports":true}'::jsonb,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	"assignment_reason" text,
	"is_temporary" boolean DEFAULT false,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"auto_expire" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"is_confirmed" boolean DEFAULT false,
	"confirmed_at" timestamp,
	"can_delegate" boolean DEFAULT false,
	"delegation_limits" jsonb DEFAULT '{}'::jsonb,
	"is_emergency_contact" boolean DEFAULT false,
	"emergency_contact_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_logs_event_id_idx" ON "webhook_logs" ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_logs_event_type_idx" ON "webhook_logs" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_logs_status_idx" ON "webhook_logs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_logs_created_at_idx" ON "webhook_logs" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_credit_config" ON "credit_configurations" ("tenant_id","operation_code");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_tenants_tenant_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_primary_organization_id_tenants_tenant_id_fk" FOREIGN KEY ("primary_organization_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_manager_relationships" ADD CONSTRAINT "user_manager_relationships_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_manager_relationships" ADD CONSTRAINT "user_manager_relationships_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_manager_relationships" ADD CONSTRAINT "user_manager_relationships_manager_id_tenant_users_user_id_fk" FOREIGN KEY ("manager_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("subscription_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_requested_by_tenants_tenant_id_fk" FOREIGN KEY ("refund_requested_by") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_parent_entity_id_entities_entity_id_fk" FOREIGN KEY ("parent_entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_organization_id_tenants_tenant_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_parent_role_id_custom_roles_role_id_fk" FOREIGN KEY ("parent_role_id") REFERENCES "custom_roles"("role_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_created_by_tenant_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_last_modified_by_tenant_users_user_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_custom_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "custom_roles"("role_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_tenants_tenant_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_inherited_from_user_role_assignments_id_fk" FOREIGN KEY ("inherited_from") REFERENCES "user_role_assignments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_assigned_by_tenant_users_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_deactivated_by_tenant_users_user_id_fk" FOREIGN KEY ("deactivated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_organization_id_tenants_tenant_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_metrics_daily" ADD CONSTRAINT "usage_metrics_daily_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_metrics_daily" ADD CONSTRAINT "usage_metrics_daily_organization_id_tenants_tenant_id_fk" FOREIGN KEY ("organization_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "application_modules" ADD CONSTRAINT "application_modules_app_id_applications_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("app_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_applications" ADD CONSTRAINT "organization_applications_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_applications" ADD CONSTRAINT "organization_applications_app_id_applications_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("app_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_application_permissions" ADD CONSTRAINT "user_application_permissions_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_application_permissions" ADD CONSTRAINT "user_application_permissions_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_application_permissions" ADD CONSTRAINT "user_application_permissions_app_id_applications_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "applications"("app_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_application_permissions" ADD CONSTRAINT "user_application_permissions_module_id_application_modules_module_id_fk" FOREIGN KEY ("module_id") REFERENCES "application_modules"("module_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_application_permissions" ADD CONSTRAINT "user_application_permissions_granted_by_tenant_users_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_entity_id_entities_entity_id_fk" FOREIGN KEY ("parent_entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_responsible_person_id_tenant_users_user_id_fk" FOREIGN KEY ("responsible_person_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_created_by_tenant_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_updated_by_tenant_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_membership_id_organization_memberships_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("membership_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_history" ADD CONSTRAINT "membership_history_changed_by_tenant_users_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitations_membership_id_organization_memberships_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "organization_memberships"("membership_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitations_invited_user_id_tenant_users_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitations_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitations_role_id_custom_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "custom_roles"("role_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "membership_invitations" ADD CONSTRAINT "membership_invitations_invited_by_tenant_users_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_role_id_custom_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "custom_roles"("role_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_invited_by_tenant_users_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_created_by_tenant_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_updated_by_tenant_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_initiated_by_tenant_users_user_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credits" ADD CONSTRAINT "credits_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credits" ADD CONSTRAINT "credits_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_requested_by_tenant_users_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_usage" ADD CONSTRAINT "credit_usage_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_usage" ADD CONSTRAINT "credit_usage_entity_id_entities_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_usage" ADD CONSTRAINT "credit_usage_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_configurations" ADD CONSTRAINT "credit_configurations_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_configurations" ADD CONSTRAINT "credit_configurations_created_by_tenant_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_configurations" ADD CONSTRAINT "credit_configurations_updated_by_tenant_users_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "responsibility_history" ADD CONSTRAINT "responsibility_history_assignment_id_responsible_persons_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "responsible_persons"("assignment_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "responsibility_history" ADD CONSTRAINT "responsibility_history_changed_by_tenant_users_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "responsibility_notifications" ADD CONSTRAINT "responsibility_notifications_assignment_id_responsible_persons_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "responsible_persons"("assignment_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "responsible_persons" ADD CONSTRAINT "responsible_persons_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "responsible_persons" ADD CONSTRAINT "responsible_persons_user_id_tenant_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "responsible_persons" ADD CONSTRAINT "responsible_persons_assigned_by_tenant_users_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "tenant_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
