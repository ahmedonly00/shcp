-- Track which pharmacist dispensed each prescription.
-- Nullable: prescriptions start with no assigned pharmacist and are claimed during fulfilment.
ALTER TABLE prescriptions
    ADD COLUMN dispensed_by UUID
        REFERENCES pharmacists(user_id) ON DELETE SET NULL;

CREATE INDEX idx_prescriptions_dispensed_by ON prescriptions(dispensed_by);
