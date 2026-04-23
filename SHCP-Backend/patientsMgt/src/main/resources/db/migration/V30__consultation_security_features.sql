-- ─────────────────────────────────────────────────────────────────────────────
-- V30 — Consultation security features
--   1. Immutable audit event log for every call-lifecycle event
--   2. Recording-consent tracking columns on consultations
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Audit event log ────────────────────────────────────────────────────────
CREATE TABLE consultation_audit_events (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id  UUID        NOT NULL REFERENCES consultations(consultation_id) ON DELETE CASCADE,
    room_id          VARCHAR(100),
    event_type       VARCHAR(50)  NOT NULL,   -- e.g. CALL_STARTED, JOINED, RECORDING_STARTED
    participant_id   UUID,                     -- userId of the actor
    participant_role VARCHAR(20),              -- PATIENT | PROVIDER | SYSTEM
    ip_address       VARCHAR(45),
    metadata         TEXT,                     -- JSON string for extra context
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_consultation_id ON consultation_audit_events(consultation_id);
CREATE INDEX idx_audit_event_type      ON consultation_audit_events(event_type);
CREATE INDEX idx_audit_created_at      ON consultation_audit_events(created_at);

-- ── 2. Recording consent ──────────────────────────────────────────────────────
ALTER TABLE consultations
    ADD COLUMN recording_consent_at      TIMESTAMPTZ,
    ADD COLUMN recording_consent_by_id   UUID;
