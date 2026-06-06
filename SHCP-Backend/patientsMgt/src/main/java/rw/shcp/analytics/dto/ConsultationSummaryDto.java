package rw.shcp.analytics.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row in the provider's patient-consultation report.
 * Aggregates data from Consultation, Prescription, and SymptomReport.
 */
public record ConsultationSummaryDto(
        UUID   consultationId,
        UUID   patientId,
        String patientName,
        OffsetDateTime startedAt,
        Integer durationMinutes,
        /** First prescribed medication name, aiPathway, or consultation notes excerpt. */
        String diagnosis,
        /** aiUrgency from the patient's latest SymptomReport (EMERGENCY/URGENT/ROUTINE/SELF_CARE/UNKNOWN). */
        String urgencyLevel,
        /** PrescriptionStatus.name() of the prescription linked to this consultation, or null. */
        String prescriptionStatus
) {}
