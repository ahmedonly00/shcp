package rw.shcp.analytics.dto;

import java.util.List;

public record ReportDataDto(
        String fromDate,
        String toDate,
        List<String> metrics,

        // Consultations
        Long totalConsultations,
        Long completedConsultations,
        Double avgConsultationDurationMinutes,

        // Appointments
        Long totalAppointments,
        Long completedAppointments,
        Long cancelledAppointments,
        List<DailyCountDto> dailyAppointments,

        // Registrations
        Long newPatients,
        Long newProviders,
        List<DailyCountDto> dailyRegistrations,

        // Symptom reports
        Long totalSymptomReports,

        // Prescriptions
        Long totalPrescriptions,
        Long activePrescriptions,

        // Providers
        Long activeProviders,
        Long totalProviders
) {}
