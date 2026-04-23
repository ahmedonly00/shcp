-- Add metadata JSONB column to notifications for debugging and audit trail.
-- Stores event-specific data (e.g. appointmentId, consultationId) alongside the log entry.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
