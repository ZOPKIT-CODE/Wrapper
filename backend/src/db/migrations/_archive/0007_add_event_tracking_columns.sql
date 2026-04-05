-- Add missing columns to event_tracking table for multi-app support
-- This migration adds source_application and target_application columns

-- Add the new columns to existing event_tracking table
ALTER TABLE event_tracking
ADD COLUMN IF NOT EXISTS source_application TEXT DEFAULT 'wrapper' NOT NULL,
ADD COLUMN IF NOT EXISTS target_application TEXT NOT NULL;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_event_tracking_source_app ON event_tracking(source_application);
CREATE INDEX IF NOT EXISTS idx_event_tracking_target_app ON event_tracking(target_application);

-- Update existing records to have default values for the new required columns
UPDATE event_tracking
SET
  source_application = 'wrapper',
  target_application = 'crm'
WHERE source_application IS NULL OR target_application IS NULL;

-- Add comments for the new columns
COMMENT ON COLUMN event_tracking.source_application IS 'Application that published the event (wrapper, crm, hr, affiliate, system)';
COMMENT ON COLUMN event_tracking.target_application IS 'Application that should process the event (wrapper, crm, hr, affiliate, system)';
