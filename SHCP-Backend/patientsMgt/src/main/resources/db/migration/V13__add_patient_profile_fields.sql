ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS gender                 VARCHAR(20),
    ADD COLUMN IF NOT EXISTS emergency_contact_name  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS insurance_provider      VARCHAR(100);
