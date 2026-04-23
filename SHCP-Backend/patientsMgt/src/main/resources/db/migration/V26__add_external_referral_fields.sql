-- ── V26: Add external-institution referral fields to referrals table ──────────
-- Extends the referrals table so doctors can refer patients to external
-- institutions (hospitals, surgical centres, etc.) in addition to internal
-- specialist-to-specialist referrals.

ALTER TABLE referrals
    ADD COLUMN IF NOT EXISTS referral_type        VARCHAR(20)  NOT NULL DEFAULT 'INTERNAL',
    ADD COLUMN IF NOT EXISTS institution_name     VARCHAR(200),
    ADD COLUMN IF NOT EXISTS institution_type     VARCHAR(50),
    ADD COLUMN IF NOT EXISTS institution_address  TEXT,
    ADD COLUMN IF NOT EXISTS institution_contact  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS treatment_type       VARCHAR(50);

COMMENT ON COLUMN referrals.referral_type       IS 'INTERNAL (to a provider in the system) or EXTERNAL (to an outside institution)';
COMMENT ON COLUMN referrals.institution_name    IS 'Name of the external institution, e.g. CHUK, King Faisal Hospital';
COMMENT ON COLUMN referrals.institution_type    IS 'HOSPITAL | SURGICAL_CENTER | CLINIC | LABORATORY | IMAGING_CENTER | REHABILITATION_CENTER';
COMMENT ON COLUMN referrals.institution_address IS 'Physical address of the institution';
COMMENT ON COLUMN referrals.institution_contact IS 'Phone or email for the institution';
COMMENT ON COLUMN referrals.treatment_type      IS 'OPERATION | SPECIALIST_CARE | EMERGENCY | LAB_TESTS | IMAGING | PHYSIOTHERAPY | REHABILITATION | OTHER';
