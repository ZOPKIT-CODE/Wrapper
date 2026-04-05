-- Create entities table if it doesn't exist
CREATE TABLE IF NOT EXISTS "entities" (
	"entity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"parent_entity_id" uuid,
	"entity_level" integer DEFAULT 1,
	"entity_name" varchar(255) NOT NULL,
	"entity_code" varchar(50),
	"description" text,
	"entity_config" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"address_street" varchar(255),
	"address_city" varchar(100),
	"address_state" varchar(100),
	"address_zip" varchar(20),
	"address_country" varchar(100),
	"timezone" varchar(50) DEFAULT 'UTC',
	"business_hours" jsonb DEFAULT '{}',
	"logo_url" varchar(500),
	"primary_color" varchar(7),
	"branding_config" jsonb DEFAULT '{}',
	"responsible_person_id" uuid,
	"credit_allocation" numeric(15, 4) DEFAULT '0',
	"credit_policy" jsonb DEFAULT '{"allowCreditAllocation":true,"maxCreditLimit":0,"resetPeriod":"monthly"}',
	"operational_config" jsonb DEFAULT '{}',
	"custom_fields" jsonb DEFAULT '{}',
	"hierarchy_path" text,
	"full_hierarchy_path" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

-- Add foreign key constraints for entities table
DO $$
BEGIN
 ALTER TABLE "entities" ADD CONSTRAINT "entities_tenant_id_tenants_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add multi-entity invitation support to tenant_invitations table
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

-- Add foreign key constraint for primary_entity_id
DO $$
BEGIN
 ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_primary_entity_id_entities_entity_id_fk" FOREIGN KEY ("primary_entity_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
