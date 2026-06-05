-- Add UI customization fields to notification_templates table
-- This migration adds UI configuration support for templates

-- Add ui_config column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notification_templates'
        AND column_name = 'ui_config'
    ) THEN
        ALTER TABLE "notification_templates" 
        ADD COLUMN "ui_config" jsonb DEFAULT '{
            "backgroundColor": "#ffffff",
            "borderColor": "#d1d5db",
            "textColor": "#111827",
            "titleColor": "#111827",
            "messageColor": "#1f2937",
            "accentColor": "#3b82f6",
            "priorityBackgrounds": {
                "low": "#f0fdf4",
                "medium": "#eff6ff",
                "high": "#fffbeb",
                "urgent": "#fef2f2"
            },
            "priorityBorders": {
                "low": "#86efac",
                "medium": "#93c5fd",
                "high": "#fcd34d",
                "urgent": "#fca5a5"
            },
            "typeIndicatorColors": {
                "seasonal_credits": "#10b981",
                "credit_expiry_warning": "#f97316",
                "purchase_success": "#3b82f6",
                "plan_upgrade": "#a855f7",
                "system_update": "#6366f1",
                "feature_announcement": "#ec4899",
                "maintenance_scheduled": "#eab308",
                "security_alert": "#ef4444",
                "billing_reminder": "#dc2626",
                "default": "#6b7280"
            },
            "fontFamily": "system-ui, -apple-system, sans-serif",
            "titleFontSize": "16px",
            "titleFontWeight": "600",
            "titleLineHeight": "1.25",
            "messageFontSize": "14px",
            "messageFontWeight": "400",
            "messageLineHeight": "1.75",
            "borderRadius": "6px",
            "padding": "16px",
            "borderWidth": "0px",
            "borderLeftWidth": "4px",
            "gap": "12px",
            "showTypeIndicator": true,
            "typeIndicatorSize": "8px",
            "typeIndicatorLabelSize": "12px",
            "typeIndicatorLabelWeight": "500",
            "typeIndicatorLabelColor": "#6b7280",
            "showPriorityIcon": true,
            "priorityIconSize": "16px",
            "showActionButtons": true,
            "buttonStyle": "outline",
            "buttonSize": "sm",
            "buttonHeight": "32px",
            "buttonPadding": "12px",
            "buttonFontSize": "12px",
            "buttonFontWeight": "500",
            "showSeparator": true,
            "separatorColor": "#f3f4f6",
            "separatorMarginTop": "16px",
            "separatorPaddingTop": "12px",
            "showTimestamp": true,
            "timestampFontSize": "12px",
            "timestampColor": "#6b7280",
            "timestampFontWeight": "500",
            "shadow": "md",
            "hoverEffect": true,
            "transitionDuration": "200ms",
            "unreadTitleColor": "#111827",
            "readTitleColor": "#374151",
            "unreadMessageColor": "#1f2937",
            "readMessageColor": "#4b5563"
        }'::jsonb;
    END IF;
END $$;

-- Create tenant_template_customizations table
CREATE TABLE IF NOT EXISTS "tenant_template_customizations" (
	"customization_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL REFERENCES "tenants"("tenant_id"),
	"template_id" uuid NOT NULL REFERENCES "notification_templates"("template_id"),
	"ui_config" jsonb NOT NULL,
	"logo_url" text,
	"brand_colors" jsonb DEFAULT '{"primary": null, "secondary": null, "accent": null}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid REFERENCES "tenant_users"("user_id"),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_template_customizations_tenant_template_unique" UNIQUE("tenant_id", "template_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_template_customizations_tenant_template 
ON tenant_template_customizations(tenant_id, template_id);

CREATE INDEX IF NOT EXISTS idx_tenant_template_customizations_tenant_id 
ON tenant_template_customizations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_template_customizations_template_id 
ON tenant_template_customizations(template_id);

CREATE INDEX IF NOT EXISTS idx_tenant_template_customizations_is_active 
ON tenant_template_customizations(is_active);

