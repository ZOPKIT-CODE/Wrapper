-- Create external_applications table
-- This table stores registered external applications that can send notifications

CREATE TABLE IF NOT EXISTS "external_applications" (
	"app_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	
	-- Application identification
	"app_name" text NOT NULL,
	"app_description" text,
	
	-- Authentication
	"api_key" text NOT NULL UNIQUE,
	"api_secret" text,
	
	-- Webhook configuration
	"webhook_url" text,
	"webhook_secret" text,
	
	-- Rate limiting
	"rate_limit" integer DEFAULT 100 NOT NULL,
	
	-- Access control
	"allowed_tenants" jsonb,
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	
	-- Status
	"is_active" boolean DEFAULT true NOT NULL,
	
	-- Audit
	"created_by" uuid REFERENCES "tenant_users"("user_id"),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	
	-- Usage tracking
	"request_count" integer DEFAULT 0 NOT NULL,
	"last_request_at" timestamp,
	
	-- Metadata
	"metadata" jsonb DEFAULT '{}'
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_external_applications_api_key 
ON external_applications(api_key);

CREATE INDEX IF NOT EXISTS idx_external_applications_is_active 
ON external_applications(is_active);

CREATE INDEX IF NOT EXISTS idx_external_applications_created_by 
ON external_applications(created_by);

CREATE INDEX IF NOT EXISTS idx_external_applications_last_used_at 
ON external_applications(last_used_at DESC);

