-- ============================================================
-- V5 — Notification log table
-- Tracks every message dispatched via RabbitMQ consumers
-- ============================================================

CREATE TABLE notifications (
    notification_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL
                    REFERENCES users(user_id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
                    -- e.g. appointment.confirmed, prescription.issued, followup.reminder
    channel         VARCHAR(10) NOT NULL
                    CHECK (channel IN ('SMS', 'EMAIL', 'PUSH')),
    message         TEXT        NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DEAD_LETTERED')),
    retry_count     INTEGER     NOT NULL DEFAULT 0,
    sent_at         TIMESTAMPTZ,
    error_detail    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
