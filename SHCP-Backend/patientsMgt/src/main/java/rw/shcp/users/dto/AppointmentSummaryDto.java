package rw.shcp.users.dto;

import rw.shcp.appointments.Appointment;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AppointmentSummaryDto(
        UUID           appointmentId,
        UUID           patientId,
        String         patientName,
        UUID           providerId,
        String         providerName,
        OffsetDateTime scheduledAt,
        String         type,
        String         status,
        BigDecimal     fee,
        String         paymentStatus
) {
    public static AppointmentSummaryDto from(Appointment a) {
        return new AppointmentSummaryDto(
                a.getAppointmentId(),
                a.getPatient().getUserId(),
                a.getPatient().getUser().getName(),
                a.getProvider().getUserId(),
                a.getProvider().getUser().getName(),
                a.getScheduledAt(),
                a.getType().name(),
                a.getStatus().name(),
                a.getFee(),
                a.getPaymentStatus() != null ? a.getPaymentStatus().name() : null
        );
    }
}
