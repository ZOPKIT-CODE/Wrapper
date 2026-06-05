-- Migration: Add multi-entity invitation support to tenant_invitations table
-- Date: 2025-09-30
-- Description: Extends tenant_invitations table to support inviting users to multiple organizations/locations

-- Add new columns for multi-entity invitations
ALTER TABLE tenant_invitations
ADD COLUMN IF NOT EXISTS target_entities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS invitation_scope VARCHAR(20) DEFAULT 'tenant',
ADD COLUMN IF NOT EXISTS primary_entity_id UUID;

-- Add foreign key constraint for primary_entity_id (references entities table)
-- Note: This assumes the entities table exists. If not, you'll need to create it first.
-- ALTER TABLE tenant_invitations
-- ADD CONSTRAINT fk_tenant_invitations_primary_entity
-- FOREIGN KEY (primary_entity_id) REFERENCES entities(entity_id);

-- Add comment to document the new fields
COMMENT ON COLUMN tenant_invitations.target_entities IS 'Array of target entities with their roles: [{entityId, roleId, entityType, membershipType}]';
COMMENT ON COLUMN tenant_invitations.invitation_scope IS 'Scope of invitation: tenant, organization, location, multi-entity';
COMMENT ON COLUMN tenant_invitations.primary_entity_id IS 'User primary organization/location entity ID';

-- Create index for better query performance on invitation scope
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_scope ON tenant_invitations(invitation_scope);

-- Create index on primary_entity_id for foreign key performance
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_primary_entity ON tenant_invitations(primary_entity_id);

-- Optional: Add partial index for pending multi-entity invitations (for performance)
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_pending_multi
ON tenant_invitations(invitation_token, expires_at)
WHERE status = 'pending' AND invitation_scope = 'multi-entity';

-- Update existing invitations to have proper scope (backward compatibility)
UPDATE tenant_invitations
SET invitation_scope = 'organization'
WHERE invitation_scope = 'tenant' AND role_id IS NOT NULL;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Multi-entity invitations migration completed successfully';
    RAISE NOTICE '- Added target_entities column for storing multiple entity targets';
    RAISE NOTICE '- Added invitation_scope column for invitation type classification';
    RAISE NOTICE '- Added primary_entity_id column for user primary entity assignment';
    RAISE NOTICE '- Created performance indexes for new columns';
END $$;
