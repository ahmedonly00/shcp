-- ============================================================
-- V11 — Add health goals and activity logs to health_records
-- ============================================================

ALTER TABLE health_records
    ADD COLUMN IF NOT EXISTS goals         JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS activity_logs JSONB NOT NULL DEFAULT '[]'::jsonb;
