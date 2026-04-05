-- ============================================================================
-- Migration: Drop Credit Allocation Tables
-- ============================================================================
-- Purpose: Remove deprecated credit_allocation_transactions and credit_allocations tables
-- Reason: Applications now manage their own credit consumption
-- Date: 2024
-- 
-- IMPORTANT: This migration is IRREVERSIBLE. Backup your database before running.
-- ============================================================================

-- Step 1: Check if tables exist and show current status
DO $$
DECLARE
    allocations_exists BOOLEAN;
    transactions_exists BOOLEAN;
    allocations_count BIGINT := 0;
    transactions_count BIGINT := 0;
BEGIN
    -- Check if tables exist
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_allocations'
    ) INTO allocations_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_allocation_transactions'
    ) INTO transactions_exists;
    
    -- Count records if tables exist
    IF allocations_exists THEN
        SELECT COUNT(*) INTO allocations_count FROM credit_allocations;
    END IF;
    
    IF transactions_exists THEN
        SELECT COUNT(*) INTO transactions_count FROM credit_allocation_transactions;
    END IF;
    
    -- Display status
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration Status Check';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'credit_allocations table: % (Records: %)', 
        CASE WHEN allocations_exists THEN 'EXISTS' ELSE 'NOT FOUND' END,
        allocations_count;
    RAISE NOTICE 'credit_allocation_transactions table: % (Records: %)', 
        CASE WHEN transactions_exists THEN 'EXISTS' ELSE 'NOT FOUND' END,
        transactions_count;
    RAISE NOTICE '============================================================================';
    
    -- Warn if tables don't exist
    IF NOT allocations_exists AND NOT transactions_exists THEN
        RAISE NOTICE 'Both tables already removed. Migration not needed.';
    END IF;
END $$;

-- Step 2: Drop credit_allocation_transactions table first (has foreign key to credit_allocations)
-- Using CASCADE to automatically drop dependent objects (constraints, indexes, etc.)
DROP TABLE IF EXISTS "credit_allocation_transactions" CASCADE;

-- Step 3: Drop credit_allocations table
-- Using CASCADE to automatically drop dependent objects (constraints, indexes, etc.)
DROP TABLE IF EXISTS "credit_allocations" CASCADE;

-- Step 4: Verify tables were dropped
DO $$
DECLARE
    allocations_exists BOOLEAN;
    transactions_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_allocations'
    ) INTO allocations_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'credit_allocation_transactions'
    ) INTO transactions_exists;
    
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration Verification';
    RAISE NOTICE '============================================================================';
    
    IF NOT allocations_exists AND NOT transactions_exists THEN
        RAISE NOTICE '✅ SUCCESS: Both tables successfully dropped';
        RAISE NOTICE '   ✓ credit_allocations table removed';
        RAISE NOTICE '   ✓ credit_allocation_transactions table removed';
    ELSE
        RAISE WARNING '⚠️  WARNING: Some tables still exist';
        IF allocations_exists THEN
            RAISE WARNING '   ⚠️  credit_allocations table still exists';
        END IF;
        IF transactions_exists THEN
            RAISE WARNING '   ⚠️  credit_allocation_transactions table still exists';
        END IF;
    END IF;
    
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '   • Removed credit_allocation_transactions table';
    RAISE NOTICE '   • Removed credit_allocations table';
    RAISE NOTICE '   • Applications now manage their own credit consumption';
    RAISE NOTICE '   • Wrapper maintains only credits and credit_transactions tables';
    RAISE NOTICE '============================================================================';
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Next Steps:
-- 1. Verify your application code doesn't reference these tables
-- 2. Test onboarding flow to ensure everything works
-- 3. Applications should now manage their own credit consumption
-- ============================================================================

