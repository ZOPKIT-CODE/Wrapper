-- Fix duplicate credit configurations issue
-- This migration addresses the problem where multiple global configurations
-- exist for the same operation_code due to null tenant_id handling

-- Step 1: Remove existing duplicates, keeping the most recent one for each (tenant_id, operation_code) combination
-- For global configs (tenant_id IS NULL), we keep the most recently updated one
-- For tenant-specific configs, we keep the most recently updated one per tenant

-- Create a temporary table to identify duplicates
CREATE TEMP TABLE duplicate_configs AS
SELECT
    config_id,
    ROW_NUMBER() OVER (
        PARTITION BY COALESCE(tenant_id::text, 'global'), operation_code
        ORDER BY updated_at DESC
    ) as rn
FROM credit_configurations;

-- Delete duplicates, keeping only the most recent (rn = 1)
DELETE FROM credit_configurations
WHERE config_id IN (
    SELECT config_id
    FROM duplicate_configs
    WHERE rn > 1
);

-- Clean up temp table
DROP TABLE duplicate_configs;

-- Step 2: Drop the existing unique index that allows null duplicates
DROP INDEX IF EXISTS "unique_credit_config";

-- Step 3: Create proper unique constraints that handle null values correctly

-- For global configurations (tenant_id IS NULL): ensure unique operation_code
CREATE UNIQUE INDEX "unique_global_credit_config" ON "credit_configurations" (operation_code)
WHERE tenant_id IS NULL;

-- For tenant-specific configurations: ensure unique (tenant_id, operation_code)
CREATE UNIQUE INDEX "unique_tenant_credit_config" ON "credit_configurations" (tenant_id, operation_code)
WHERE tenant_id IS NOT NULL;

-- Alternative approach: Create a functional unique index that handles nulls properly
-- This creates a computed column that treats null tenant_id as a special value
-- CREATE UNIQUE INDEX "unique_credit_config_fixed" ON "credit_configurations" (
--     COALESCE(tenant_id::text, 'global'),
--     operation_code
-- );

-- Step 4: Add constraint to ensure data integrity going forward
-- This check constraint ensures that if tenant_id is null, is_global must be true
ALTER TABLE credit_configurations
ADD CONSTRAINT check_global_consistency
CHECK (
    (tenant_id IS NULL AND is_global = true) OR
    (tenant_id IS NOT NULL AND is_global = false)
);

-- Step 5: Create an index for better performance on common queries
CREATE INDEX idx_credit_config_lookup ON credit_configurations (tenant_id, operation_code, is_active);

-- Log the fix
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count FROM credit_configurations;
    RAISE NOTICE 'Credit configurations cleanup completed. Remaining configurations: %', remaining_count;

    -- Log duplicate removal summary
    RAISE NOTICE 'Duplicate credit configurations have been removed and proper unique constraints added.';
END $$;
