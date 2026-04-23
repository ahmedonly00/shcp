package rw.shcp.appointments.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;
import rw.shcp.common.enums.AppointmentType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record BookingRequest(

        @JsonProperty("providerId")
        @NotNull(message = "Provider ID is required")
        UUID providerId,

        /**
         * Optional: links the appointment to a pre-defined availability slot.
         * When provided, {@code scheduledAt} is inferred from the slot's startTime.
         */
        @JsonProperty("slotId")
        UUID slotId,

        /**
         * Required when {@code slotId} is null — explicit date/time for the appointment.
         */
        @JsonProperty("scheduledAt")
        @Future(message = "Scheduled time must be in the future")
        OffsetDateTime scheduledAt,

        @JsonProperty("type")
        @NotNull(message = "Appointment type is required")
        AppointmentType type,

        @JsonProperty("fee")
        BigDecimal fee,

        @JsonProperty("notes")
        String notes
) {}
