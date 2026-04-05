-- Event Tracking Table for CRM Sync Transparency
-- Tracks events published to external systems and their acknowledgment status

CREATE TABLE IF NOT EXISTS event_tracking (
  tracking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  entity_id TEXT,
  stream_key TEXT NOT NULL,
  source_application TEXT DEFAULT 'wrapper' NOT NULL,
  target_application TEXT NOT NULL,
  event_data JSONB,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  published_by TEXT,
  acknowledged BOOLEAN DEFAULT FALSE NOT NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledgment_data JSONB,
  status TEXT DEFAULT 'published' NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_event_tracking_tenant ON event_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_tracking_event_id ON event_tracking(event_id);
CREATE INDEX IF NOT EXISTS idx_event_tracking_status ON event_tracking(status);
CREATE INDEX IF NOT EXISTS idx_event_tracking_acknowledged ON event_tracking(acknowledged);
CREATE INDEX IF NOT EXISTS idx_event_tracking_published_at ON event_tracking(published_at);
CREATE INDEX IF NOT EXISTS idx_event_tracking_acknowledged_at ON event_tracking(acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_event_tracking_source_app ON event_tracking(source_application);
CREATE INDEX IF NOT EXISTS idx_event_tracking_target_app ON event_tracking(target_application);

-- Add comments for documentation
COMMENT ON TABLE event_tracking IS 'Tracks events published to external systems and their acknowledgment status';
COMMENT ON COLUMN event_tracking.tracking_id IS 'Unique tracking identifier';
COMMENT ON COLUMN event_tracking.event_id IS 'Unique event identifier from the publishing system';
COMMENT ON COLUMN event_tracking.event_type IS 'Type of event (credit.allocated, credit.consumed, etc.)';
COMMENT ON COLUMN event_tracking.tenant_id IS 'Tenant that owns the event';
COMMENT ON COLUMN event_tracking.entity_id IS 'Associated entity (organization, user, etc.)';
COMMENT ON COLUMN event_tracking.stream_key IS 'Redis stream key where event was published';
COMMENT ON COLUMN event_tracking.source_application IS 'Application that published the event (wrapper, crm, hr, affiliate, system)';
COMMENT ON COLUMN event_tracking.target_application IS 'Application that should process the event (wrapper, crm, hr, affiliate, system)';
COMMENT ON COLUMN event_tracking.event_data IS 'Original event payload data';
COMMENT ON COLUMN event_tracking.acknowledged IS 'Whether the event has been acknowledged by the receiving system';
COMMENT ON COLUMN event_tracking.acknowledgment_data IS 'Data returned in the acknowledgment';
COMMENT ON COLUMN event_tracking.status IS 'Current status: published, acknowledged, failed, timeout';
COMMENT ON COLUMN event_tracking.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN event_tracking.metadata IS 'Additional context and metadata';
