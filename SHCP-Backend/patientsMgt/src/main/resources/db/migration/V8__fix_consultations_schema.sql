-- ============================================================
-- V8 — Fix consultations table to match Consultation entity
-- ============================================================

-- Add missing created_at column
ALTER TABLE consultations
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Rename video_room_id → room_id to match entity mapping
ALTER TABLE consultations
    RENAME COLUMN video_room_id TO room_id;

-- Update status CHECK constraint to include SCHEDULED
ALTER TABLE consultations
    DROP CONSTRAINT IF EXISTS consultations_status_check;

ALTER TABLE consultations
    ADD CONSTRAINT consultations_status_check
    CHECK (status IN ('SCHEDULED', 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'));
