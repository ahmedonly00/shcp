package rw.shcp.analytics.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row in the admin-level all-provider consultation report.
 * Aggregates Consultation, Prescription, and SymptomReport data.
 */
public record AdminConsultationRowDto(
        UUID   consultationId,
        String providerName,
        UUID   patientId,
        String patientName,
        OffsetDateTime startedAt,
        Integer durationMinutes,
        /** Primary diagnosis label: first prescribed medication, aiPathway, or notes excerpt. */
        String diagnosis,
        /** Comma-separated list of all medication names from the linked prescription. */
        String medications,
        /** aiUrgency from the patient's latest SymptomReport. */
        String urgencyLevel,
        /** PrescriptionStatus.name() of the prescription linked to this consultation, or null. */
        String prescriptionStatus
) {}
