package rw.shcp.appointments.dto;

import rw.shcp.appointments.Availability;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AvailableSlotDto(
        UUID           slotId,
        UUID           providerId,
        String         providerName,
        String         specialty,
        String         facility,
        BigDecimal     rating,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        String         appointmentType
) {
    public static AvailableSlotDto from(Availability slot) {
        return new AvailableSlotDto(
                slot.getSlotId(),
                slot.getProvider().getUserId(),
                slot.getProvider().getUser().getName(),
                slot.getProvider().getSpecialty(),
                slot.getProvider().getFacility(),
                slot.getProvider().getRating(),
                slot.getStartTime(),
                slot.getEndTime(),
                slot.getAppointmentType() != null ? slot.getAppointmentType().name() : null
        );
    }
}
