-- V21 — Add provider_signature column to prescriptions table
-- Captures the prescribing provider's full name as a digital signature at time of issue.

ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS provider_signature VARCHAR(500);
