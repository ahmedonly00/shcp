-- ============================================================
-- V33 — Symptom feedback (patient post-screening response)
-- ============================================================
-- Records whether the AI screening matched the doctor's diagnosis.
-- One row per symptom report (unique constraint on report_id).
-- Used by the ai-service training/feedback_export.py pipeline to
-- generate confirmed training data for model retraining.

CREATE TABLE symptom_feedback (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id        UUID        NOT NULL UNIQUE
                     REFERENCES symptom_reports(report_id) ON DELETE CASCADE,
    was_correct      BOOLEAN,
    doctor_diagnosis VARCHAR(255),
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_symptom_feedback_report_id ON symptom_feedback(report_id);
CREATE INDEX idx_symptom_feedback_was_correct ON symptom_feedback(was_correct)
    WHERE was_correct IS NOT NULL;
