-- V35 — Align prescriptions table with current Prescription entity
-- Fixes five divergences introduced by V4 + V9:
--   1. status CHECK allowed only ACTIVE/FILLED/EXPIRED/CANCELLED — entity uses PENDING/PROCESSING/…
--   2. status column was VARCHAR(20) — entity declares length = 25 (ddl-auto: validate fails)
--   3. pharmacy_id was dropped in V9 — entity needs it for nearest-pharmacy assignment
--   4. consultation_id was NOT NULL — entity allows standalone (non-consultation) prescriptions
--   5. delivery_address / delivery_latitude / delivery_longitude were never added

-- 1. Drop the old status CHECK and re-create with the full enum set
--    Widen the column first so VARCHAR(25) matches the entity's declared length.
ALTER TABLE prescriptions
    DROP CONSTRAINT IF EXISTS prescriptions_status_check;

ALTER TABLE prescriptions
    ALTER COLUMN status TYPE VARCHAR(25),
    ALTER COLUMN status SET DEFAULT 'PENDING',
    ADD CONSTRAINT prescriptions_status_check
        CHECK (status IN (
            'PENDING', 'PROCESSING', 'READY_FOR_DELIVERY',
            'PICKED_UP', 'ON_THE_WAY', 'DELIVERED',
            'FAILED', 'CANCELLED', 'EXPIRED'
        ));

-- Migrate any rows that were written with the old status values
UPDATE prescriptions SET status = 'PENDING'   WHERE status = 'ACTIVE';
UPDATE prescriptions SET status = 'DELIVERED' WHERE status = 'FILLED';

-- 2. Re-add pharmacy_id (dropped in V9)
ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS pharmacy_id UUID
        REFERENCES pharmacies(pharmacy_id) ON DELETE SET NULL;

-- 3. Make consultation_id nullable (was NOT NULL in V4)
ALTER TABLE prescriptions
    ALTER COLUMN consultation_id DROP NOT NULL;

-- 4. Add missing delivery columns
ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS delivery_address  VARCHAR(300),
    ADD COLUMN IF NOT EXISTS delivery_latitude  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;
