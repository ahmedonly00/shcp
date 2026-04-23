-- ============================================================
-- V9 — Align prescriptions table with Prescription entity
-- ============================================================

-- 1. Add missing columns
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_id UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS provider_id UUID;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Add foreign key constraints
ALTER TABLE prescriptions
    ADD CONSTRAINT fk_prescriptions_patient
    FOREIGN KEY (patient_id) REFERENCES patients(user_id);

ALTER TABLE prescriptions
    ADD CONSTRAINT fk_prescriptions_provider
    FOREIGN KEY (provider_id) REFERENCES providers(user_id);

-- 3. Add status CHECK constraint
ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_status_check
    CHECK (status IN ('ACTIVE', 'FILLED', 'EXPIRED', 'CANCELLED'));

-- 4. Drop columns that are no longer in the entity
ALTER TABLE prescriptions DROP COLUMN IF EXISTS issued_by;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS interaction_alerts;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS digital_signature;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS pharmacy_id;
ALTER TABLE prescriptions DROP COLUMN IF EXISTS pharmacy_status;

-- 5. Drop the old pharmacy_status CHECK constraint
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_pharmacy_status_check;
