-- V23 — Pharmacy & Delivery System
-- Adds: pharmacies, pharmacists, bikers, deliveries tables
-- Updates: users.role constraint, prescriptions (pharmacy_id, delivery_address, status)

-- ─────────────────────────────────────────────────────────────
-- 1. Extend users.role to include PHARMACIST and BIKER
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('PATIENT', 'PROVIDER', 'PHARMACIST', 'BIKER', 'ADMIN'));

-- ─────────────────────────────────────────────────────────────
-- 2. Create pharmacies table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE pharmacies (
    pharmacy_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    address         VARCHAR(300) NOT NULL,
    district        VARCHAR(60),
    operating_zone  VARCHAR(100),
    phone           VARCHAR(20),
    email           VARCHAR(150),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 3. Create pharmacists table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE pharmacists (
    user_id         UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    pharmacy_id     UUID NOT NULL REFERENCES pharmacies(pharmacy_id) ON DELETE RESTRICT
);

CREATE INDEX idx_pharmacists_pharmacy ON pharmacists(pharmacy_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Create bikers table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE bikers (
    user_id         UUID        PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    pharmacy_id     UUID        NOT NULL REFERENCES pharmacies(pharmacy_id) ON DELETE RESTRICT,
    license_number  VARCHAR(50),
    vehicle_type    VARCHAR(50),
    operating_zone  VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'OFFLINE'
                    CHECK (status IN ('AVAILABLE', 'ON_DELIVERY', 'OFFLINE'))
);

CREATE INDEX idx_bikers_pharmacy ON bikers(pharmacy_id);
CREATE INDEX idx_bikers_status   ON bikers(status);

-- ─────────────────────────────────────────────────────────────
-- 5. Update prescriptions — new columns and status values
-- ─────────────────────────────────────────────────────────────
ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS pharmacy_id     UUID REFERENCES pharmacies(pharmacy_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(300);

CREATE INDEX idx_prescriptions_pharmacy ON prescriptions(pharmacy_id);

-- Migrate existing status values to new enum members
UPDATE prescriptions SET status = 'PENDING'    WHERE status = 'ACTIVE';
UPDATE prescriptions SET status = 'DELIVERED'  WHERE status = 'FILLED';

-- Replace the status CHECK constraint
ALTER TABLE prescriptions
    DROP CONSTRAINT IF EXISTS prescriptions_status_check;

ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_status_check
    CHECK (status IN (
        'PENDING', 'PROCESSING', 'READY_FOR_DELIVERY',
        'PICKED_UP', 'ON_THE_WAY', 'DELIVERED',
        'FAILED', 'CANCELLED', 'EXPIRED'
    ));

ALTER TABLE prescriptions
    ALTER COLUMN status SET DEFAULT 'PENDING';

-- ─────────────────────────────────────────────────────────────
-- 6. Create deliveries table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE deliveries (
    delivery_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id         UUID        NOT NULL UNIQUE REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
    biker_id                UUID        REFERENCES bikers(user_id) ON DELETE SET NULL,
    status                  VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED'
                            CHECK (status IN ('ASSIGNED','ACCEPTED','PICKED_UP','ON_THE_WAY','DELIVERED','DECLINED','FAILED')),
    assigned_at             TIMESTAMPTZ,
    accepted_at             TIMESTAMPTZ,
    picked_up_at            TIMESTAMPTZ,
    delivered_at            TIMESTAMPTZ,
    confirmation_photo_url  VARCHAR(500),
    failure_reason          VARCHAR(300),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_biker        ON deliveries(biker_id);
CREATE INDEX idx_deliveries_prescription ON deliveries(prescription_id);
CREATE INDEX idx_deliveries_status       ON deliveries(status);
