-- MOH scheduled report configuration (single-row settings table)
CREATE TABLE IF NOT EXISTS moh_report_config (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_emails TEXT        NOT NULL DEFAULT '[]',
    schedule         VARCHAR(20) NOT NULL DEFAULT 'WEEKLY',
    metrics          TEXT        NOT NULL DEFAULT '["consultations","appointments","registrations","symptoms","prescriptions","providers"]',
    enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
    last_sent_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a default (disabled) row so the config always exists
INSERT INTO moh_report_config (recipient_emails, schedule, metrics, enabled)
VALUES ('[]', 'WEEKLY', '["consultations","appointments","registrations","symptoms","prescriptions","providers"]', FALSE)
ON CONFLICT DO NOTHING;

-- care_recommendation was added here originally before it was included in V4.
-- The ALTER TABLE is kept with IF NOT EXISTS so this migration remains safe to
-- run against databases that were initialised before V4 was updated.
-- On fresh deployments the column already exists from V4 and this is a no-op.
ALTER TABLE symptom_reports ADD COLUMN IF NOT EXISTS care_recommendation TEXT;
