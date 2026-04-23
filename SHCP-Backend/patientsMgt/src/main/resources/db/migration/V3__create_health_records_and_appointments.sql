-- ============================================================
-- V3 — Health records, provider availability, and appointments
-- ============================================================

-- ── Electronic Health Records ─────────────────────────────────
CREATE TABLE health_records (
    record_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id    UUID        NOT NULL
                  REFERENCES patients(user_id) ON DELETE CASCADE,
    diagnoses     JSONB       DEFAULT '[]'::jsonb,
    medications   JSONB       DEFAULT '[]'::jsonb,
    allergies     JSONB       DEFAULT '[]'::jsonb,
    vitals        JSONB       DEFAULT '{}'::jsonb,
    immunizations JSONB       DEFAULT '[]'::jsonb,
    lab_results   JSONB       DEFAULT '[]'::jsonb,
    documents     JSONB       DEFAULT '[]'::jsonb,   -- uploaded file refs
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT one_record_per_patient UNIQUE (patient_id)
);

CREATE TRIGGER trg_health_records_updated_at
    BEFORE UPDATE ON health_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Provider Availability Slots ───────────────────────────────
CREATE TABLE availability (
    slot_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id      UUID        NOT NULL
                     REFERENCES providers(user_id) ON DELETE CASCADE,
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ NOT NULL,
    is_booked        BOOLEAN     NOT NULL DEFAULT false,
    appointment_type VARCHAR(20) CHECK (appointment_type IN ('VIDEO', 'FOLLOWUP', 'URGENT')),
    CONSTRAINT no_overlapping_slots UNIQUE (provider_id, start_time),
    CONSTRAINT end_after_start CHECK (end_time > start_time)
);

-- ── Appointments ──────────────────────────────────────────────
CREATE TABLE appointments (
    appointment_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID        NOT NULL
                        REFERENCES patients(user_id),
    provider_id         UUID        NOT NULL
                        REFERENCES providers(user_id),
    slot_id             UUID
                        REFERENCES availability(slot_id),
    scheduled_at        TIMESTAMPTZ NOT NULL,
    type                VARCHAR(20) NOT NULL
                        CHECK (type IN ('VIDEO', 'FOLLOWUP', 'URGENT')),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS',
                                          'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    fee                 DECIMAL(10,2),
    payment_status      VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (payment_status IN ('PENDING', 'PAID', 'WAIVED', 'REFUNDED')),
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT no_double_booking UNIQUE (provider_id, scheduled_at)
);
