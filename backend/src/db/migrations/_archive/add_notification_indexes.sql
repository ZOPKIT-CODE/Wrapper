-- Add composite indexes for notification queries
-- These indexes optimize common query patterns

-- Index for tenant notification queries (most common)
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_active_created 
ON notifications(tenant_id, is_active, created_at DESC);

-- Index for admin queries by type and priority
CREATE INDEX IF NOT EXISTS idx_notifications_type_priority_created 
ON notifications(type, priority, created_at DESC);

-- Index for scheduled notifications
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_active 
ON notifications(scheduled_at, is_active) 
WHERE scheduled_at IS NOT NULL;

-- Index for expired notifications cleanup
CREATE INDEX IF NOT EXISTS idx_notifications_expires_active 
ON notifications(expires_at, is_active) 
WHERE expires_at IS NOT NULL;

-- Index for user-specific notifications
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_active 
ON notifications(tenant_id, target_user_id, is_active, created_at DESC) 
WHERE target_user_id IS NOT NULL;

-- Index for read status queries
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_read 
ON notifications(tenant_id, is_read, created_at DESC) 
WHERE is_active = true;

-- Index for admin notification history queries
CREATE INDEX IF NOT EXISTS idx_admin_notification_history_admin_sent 
ON admin_notification_history(admin_user_id, sent_at DESC);

-- Index for admin notification history by tenant
CREATE INDEX IF NOT EXISTS idx_admin_notification_history_tenant_sent 
ON admin_notification_history(tenant_id, sent_at DESC);

-- Index for admin notification history by status
CREATE INDEX IF NOT EXISTS idx_admin_notification_history_status_sent 
ON admin_notification_history(status, sent_at DESC);

-- Index for notification templates by category and active status
CREATE INDEX IF NOT EXISTS idx_notification_templates_category_active 
ON notification_templates(category, is_active, created_at DESC);

-- Index for notification templates by type
CREATE INDEX IF NOT EXISTS idx_notification_templates_type_active 
ON notification_templates(type, is_active, created_at DESC);











