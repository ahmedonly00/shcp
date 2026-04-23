-- V22 — Align consultations.status DB constraint with the Java ConsultationStatus enum.
--
-- Java enum:    SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
-- Old DB CHECK: SCHEDULED | WAITING | IN_PROGRESS | COMPLETED | ABANDONED
--
-- Problems fixed:
--   1. WAITING (V4 default) and ABANDONED cannot be deserialised by Hibernate → map to safe values.
--   2. CANCELLED exists in the enum but was missing from the constraint → add it.

-- 1. Migrate legacy status values to their closest enum equivalent
UPDATE consultations SET status = 'SCHEDULED'  WHERE status = 'WAITING';
UPDATE consultations SET status = 'CANCELLED'  WHERE status = 'ABANDONED';

-- 2. Replace the old CHECK constraint with one that exactly matches the Java enum
ALTER TABLE consultations
    DROP CONSTRAINT IF EXISTS consultations_status_check;

ALTER TABLE consultations
    ADD CONSTRAINT consultations_status_check
    CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

-- 3. Fix the column default so new rows start as SCHEDULED (matches entity default)
ALTER TABLE consultations
    ALTER COLUMN status SET DEFAULT 'SCHEDULED';
