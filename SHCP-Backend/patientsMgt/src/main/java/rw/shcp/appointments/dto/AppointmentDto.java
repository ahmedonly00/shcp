package rw.shcp.appointments.dto;

import rw.shcp.appointments.Appointment;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AppointmentDto(
        UUID           appointmentId,
        UUID           patientId,
        String         patientName,
        UUID           providerId,
        String         providerName,
        String         providerSpecialty,
        UUID           slotId,
        OffsetDateTime scheduledAt,
        String         type,
        String         status,
        BigDecimal     fee,
        String         paymentStatus,
        String         notes,
        String         cancellationReason,
        OffsetDateTime createdAt
) {
    public static AppointmentDto from(Appointment a) {
        return new AppointmentDto(
                a.getAppointmentId(),
                a.getPatient().getUserId(),
                a.getPatient().getUser().getName(),
                a.getProvider().getUserId(),
                a.getProvider().getUser().getName(),
                a.getProvider().getSpecialty(),
                a.getSlot() != null ? a.getSlot().getSlotId() : null,
                a.getScheduledAt(),
                a.getType().name(),
                a.getStatus().name(),
                a.getFee(),
                a.getPaymentStatus() != null ? a.getPaymentStatus().name() : null,
                a.getNotes(),
                a.getCancellationReason(),
                a.getCreatedAt()
        );
    }
}
