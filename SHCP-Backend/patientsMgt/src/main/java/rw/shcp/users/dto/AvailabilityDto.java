package rw.shcp.users.dto;

import rw.shcp.appointments.Availability;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AvailabilityDto(
        UUID           slotId,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        boolean        isBooked,
        boolean        isBlocked,
        String         appointmentType
) {
    public static AvailabilityDto from(Availability slot) {
        return new AvailabilityDto(
                slot.getSlotId(),
                slot.getStartTime(),
                slot.getEndTime(),
                slot.isBooked(),
                slot.isBlocked(),
                slot.getAppointmentType() != null ? slot.getAppointmentType().name() : null
        );
    }
}
