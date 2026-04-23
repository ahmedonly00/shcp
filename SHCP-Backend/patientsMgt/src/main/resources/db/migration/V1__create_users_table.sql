-- ============================================================
-- V1 — Core users table
-- All roles share this table (PATIENT / PROVIDER / ADMIN)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    user_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    role          VARCHAR(20)  NOT NULL
                  CHECK (role IN ('PATIENT', 'PROVIDER', 'ADMIN')),
    password_hash VARCHAR(255) NOT NULL,
    is_verified   BOOLEAN      NOT NULL DEFAULT false,
    language_pref VARCHAR(5)   NOT NULL DEFAULT 'rw',
    device_token  VARCHAR(500),           -- FCM push token
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
