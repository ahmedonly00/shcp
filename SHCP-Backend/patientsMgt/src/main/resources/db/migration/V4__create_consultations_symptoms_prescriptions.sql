-- ============================================================
-- V4 — Consultations, AI symptom reports, and prescriptions
-- ============================================================

-- ── Video Consultations ───────────────────────────────────────
CREATE TABLE consultations (
    consultation_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id   UUID        UNIQUE NOT NULL
                     REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    video_room_id    VARCHAR(100),
    started_at       TIMESTAMPTZ,
    ended_at         TIMESTAMPTZ,
    duration_minutes INTEGER     CHECK (duration_minutes >= 0),
    notes            TEXT,
    diagnosis        TEXT,
    recording_url    VARCHAR(500),
    status           VARCHAR(20) NOT NULL DEFAULT 'WAITING'
                     CHECK (status IN ('WAITING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'))
);

-- ── AI Symptom Reports ────────────────────────────────────────
CREATE TABLE symptom_reports (
    report_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id         UUID        NOT NULL
                       REFERENCES patients(user_id) ON DELETE CASCADE,
    symptoms           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    body_map_data      JSONB,
    symptom_text       TEXT,
    language           VARCHAR(5)  NOT NULL DEFAULT 'rw',
    ai_urgency         VARCHAR(20) CHECK (ai_urgency IN ('EMERGENCY', 'URGENT',
                                                          'ROUTINE', 'SELF_CARE', 'UNKNOWN')),
    ai_pathway         VARCHAR(50),
    ai_confidence      DECIMAL(5,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    care_recommendation TEXT,
    ai_raw_response    JSONB,      -- full Flask response stored for audit
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Digital Prescriptions ─────────────────────────────────────
CREATE TABLE prescriptions (
    prescription_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id    UUID        NOT NULL
                       REFERENCES consultations(consultation_id),
    issued_by          UUID        NOT NULL
                       REFERENCES providers(user_id),
    medications        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    interaction_alerts JSONB       DEFAULT '[]'::jsonb,
    digital_signature  TEXT        NOT NULL,
    pharmacy_id        UUID,
    pharmacy_status    VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                       CHECK (pharmacy_status IN ('PENDING', 'DISPENSED',
                                                  'REJECTED', 'REFILL_REQUESTED')),
    valid_until        DATE        NOT NULL,
    issued_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
