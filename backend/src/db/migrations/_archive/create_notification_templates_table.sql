-- Create notification_templates table
-- This table stores reusable notification templates for admin use

CREATE TABLE IF NOT EXISTS "notification_templates" (
	"template_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	
	-- Template identification
	"name" text NOT NULL,
	"category" text DEFAULT 'custom' NOT NULL,
	"description" text,
	
	-- Template content
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"action_url" text,
	"action_label" text,
	
	-- Template variables (for substitution)
	"variables" jsonb DEFAULT '{}',
	
	-- Default metadata
	"metadata" jsonb DEFAULT '{}',
	
	-- Template management
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"version" text DEFAULT '1.0.0',
	
	-- Audit
	"created_by" uuid REFERENCES "tenant_users"("user_id"),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_templates_category_active 
ON notification_templates(category, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_templates_type_active 
ON notification_templates(type, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active 
ON notification_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_notification_templates_created_by 
ON notification_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_notification_templates_created_at 
ON notification_templates(created_at DESC);

