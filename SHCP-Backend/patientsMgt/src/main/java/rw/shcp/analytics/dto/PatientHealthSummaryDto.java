package rw.shcp.analytics.dto;

import java.util.List;

/**
 * A patient's own health analytics snapshot.
 */
public record PatientHealthSummaryDto(
        // ── Appointments ───────────────────────────────────────────────────
        AppointmentBreakdownDto appointments,
        long upcomingAppointments,

        // ── Consultations ──────────────────────────────────────────────────
        long totalConsultations,

        // ── Symptoms ───────────────────────────────────────────────────────
        long totalSymptomReports,
        List<UrgencyDistributionDto> urgencyBreakdown,

        // ── Prescriptions ──────────────────────────────────────────────────
        long totalPrescriptions,
        long activePrescriptions
) {}
