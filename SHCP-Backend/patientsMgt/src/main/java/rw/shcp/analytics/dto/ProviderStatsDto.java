package rw.shcp.analytics.dto;

/**
 * A provider's own performance analytics snapshot.
 */
public record ProviderStatsDto(
        long uniquePatients,
        AppointmentBreakdownDto appointments,
        long totalConsultations,
        long completedConsultations,
        double avgConsultationDurationMinutes,
        long totalPrescriptionsIssued,
        long activePrescriptionsIssued
) {}
