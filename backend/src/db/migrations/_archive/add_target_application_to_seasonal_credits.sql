-- Migration: Add targetApplication field to existing seasonal_credit_allocations table
-- This migration is safe to run even if the column already exists

-- Add target_application column only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'seasonal_credit_allocations' 
        AND column_name = 'target_application'
    ) THEN
        ALTER TABLE seasonal_credit_allocations 
        ADD COLUMN target_application VARCHAR(50);
        
        RAISE NOTICE 'Added target_application column to seasonal_credit_allocations';
    ELSE
        RAISE NOTICE 'Column target_application already exists in seasonal_credit_allocations';
    END IF;
END $$;

-- Create index for efficient queries by target application (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_seasonal_credit_allocations_target_app 
ON seasonal_credit_allocations(target_application) 
WHERE target_application IS NOT NULL;

-- Create composite index for expiry queries with target application (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_seasonal_credit_allocations_expiry_app 
ON seasonal_credit_allocations(expires_at, target_application, is_active, is_expired) 
WHERE is_active = true AND is_expired = false;

-- Add comment to column
COMMENT ON COLUMN seasonal_credit_allocations.target_application IS 
'NULL = allocated to primary org (all applications can use), specific app code (e.g., crm, hr) = allocated only to that application';

















