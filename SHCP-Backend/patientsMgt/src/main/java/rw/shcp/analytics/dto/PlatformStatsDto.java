package rw.shcp.analytics.dto;

/**
 * Admin-only platform-wide overview snapshot.
 */
public record PlatformStatsDto(
        // ── Users ──────────────────────────────────────────────────────────
        long totalPatients,
        long totalProviders,
        long totalAdmins,
        long activeProviders,

        // ── Appointments ───────────────────────────────────────────────────
        AppointmentBreakdownDto appointments,

        // ── Consultations ──────────────────────────────────────────────────
        long totalConsultations,
        long completedConsultations,
        double avgConsultationDurationMinutes,

        // ── Clinical ───────────────────────────────────────────────────────
        long totalSymptomReports,
        long totalPrescriptions,
        long activePrescriptions,

        // ── Pharmacy network ───────────────────────────────────────────────
        long totalPharmacies,
        long totalPharmacists,
        long totalBikers
) {}
