-- ── FR1: Account lockout ──────────────────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ;

-- ── FR5: Provider geographic location ─────────────────────────────────────────
ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS location VARCHAR(100),
    ADD COLUMN IF NOT EXISTS district VARCHAR(60);

-- ── FR5: Waitlist ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist_entries (
    entry_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id   UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider_id  UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    date         DATE        NOT NULL,
    type         VARCHAR(20) NOT NULL DEFAULT 'VIDEO',
    notified     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, provider_id, date)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_provider_date ON waitlist_entries(provider_id, date);

-- ── FR6: Specialist referrals ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
    referral_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    referring_provider_id UUID    NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    specialist_id     UUID        REFERENCES users(user_id) ON DELETE SET NULL,
    consultation_id   UUID        REFERENCES consultations(consultation_id) ON DELETE SET NULL,
    specialty_needed  VARCHAR(100) NOT NULL,
    reason            TEXT        NOT NULL,
    urgency           VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_patient   ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referring  ON referrals(referring_provider_id);
CREATE INDEX IF NOT EXISTS idx_referrals_specialist ON referrals(specialist_id);
