-- Fix primary_organization_id foreign key constraint to reference entities instead of tenants

-- Drop the existing foreign key constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'tenant_users_primary_organization_id_tenants_tenant_id_fk') THEN
        ALTER TABLE "tenant_users" DROP CONSTRAINT "tenant_users_primary_organization_id_tenants_tenant_id_fk";
    END IF;
END $$;

-- Add the new foreign key constraint pointing to entities
DO $$
BEGIN
 ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_primary_organization_id_entities_entity_id_fk" FOREIGN KEY ("primary_organization_id") REFERENCES "entities"("entity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
