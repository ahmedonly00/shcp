-- ============================================================
-- V2 — Role-specific profile tables
-- patients and providers extend users via FK (table-per-class)
-- ============================================================

-- ── Patients ─────────────────────────────────────────────────
CREATE TABLE patients (
    user_id          UUID        PRIMARY KEY
                     REFERENCES users(user_id) ON DELETE CASCADE,
    date_of_birth    DATE        NOT NULL,
    blood_type       VARCHAR(10),
    insurance_number VARCHAR(50),
    national_id      VARCHAR(20) UNIQUE NOT NULL
);

-- ── Healthcare Providers (Doctors / Nurses) ───────────────────
CREATE TABLE providers (
    user_id        UUID         PRIMARY KEY
                   REFERENCES users(user_id) ON DELETE CASCADE,
    license_number VARCHAR(50)  UNIQUE NOT NULL,
    specialty      VARCHAR(100) NOT NULL,
    facility       VARCHAR(150),
    rating         DECIMAL(3,2) NOT NULL DEFAULT 0.00
                   CHECK (rating >= 0 AND rating <= 5),
    is_active      BOOLEAN      NOT NULL DEFAULT true
);

-- ── Admins ────────────────────────────────────────────────────
-- No extra columns needed; existence in users with role=ADMIN is sufficient.
-- Table kept for future admin-specific metadata.
CREATE TABLE admins (
    user_id      UUID PRIMARY KEY
                 REFERENCES users(user_id) ON DELETE CASCADE,
    access_level VARCHAR(30) NOT NULL DEFAULT 'STANDARD'
                 CHECK (access_level IN ('STANDARD', 'SUPER'))
);
