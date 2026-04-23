-- ============================================================
-- V6 — Performance indexes
-- ============================================================

-- users
CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_role           ON users(role);

-- patients
CREATE INDEX idx_patients_national_id ON patients(national_id);

-- providers
CREATE INDEX idx_providers_specialty  ON providers(specialty);
CREATE INDEX idx_providers_is_active  ON providers(is_active);

-- health_records
CREATE INDEX idx_health_records_patient ON health_records(patient_id);

-- availability
CREATE INDEX idx_availability_provider       ON availability(provider_id);
CREATE INDEX idx_availability_start_time     ON availability(start_time);
CREATE INDEX idx_availability_provider_booked ON availability(provider_id, is_booked);

-- appointments
CREATE INDEX idx_appointments_patient     ON appointments(patient_id);
CREATE INDEX idx_appointments_provider    ON appointments(provider_id);
CREATE INDEX idx_appointments_scheduled   ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status      ON appointments(status);
CREATE INDEX idx_appointments_patient_status ON appointments(patient_id, status);

-- consultations
CREATE INDEX idx_consultations_appointment ON consultations(appointment_id);
CREATE INDEX idx_consultations_status      ON consultations(status);

-- symptom_reports
CREATE INDEX idx_symptom_reports_patient   ON symptom_reports(patient_id);
CREATE INDEX idx_symptom_reports_urgency   ON symptom_reports(ai_urgency);
CREATE INDEX idx_symptom_reports_created   ON symptom_reports(created_at DESC);

-- prescriptions
CREATE INDEX idx_prescriptions_consultation ON prescriptions(consultation_id);
CREATE INDEX idx_prescriptions_issued_by    ON prescriptions(issued_by);
CREATE INDEX idx_prescriptions_valid_until  ON prescriptions(valid_until);

-- notifications
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_created     ON notifications(created_at DESC);

-- GIN indexes for JSONB columns (full document search)
CREATE INDEX idx_health_records_diagnoses_gin  ON health_records USING GIN(diagnoses);
CREATE INDEX idx_health_records_medications_gin ON health_records USING GIN(medications);
CREATE INDEX idx_symptom_reports_symptoms_gin  ON symptom_reports USING GIN(symptoms);
CREATE INDEX idx_prescriptions_medications_gin ON prescriptions USING GIN(medications);
