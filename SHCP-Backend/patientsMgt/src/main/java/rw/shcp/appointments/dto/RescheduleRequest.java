package rw.shcp.appointments.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Future;

import java.time.OffsetDateTime;
import java.util.UUID;

public record RescheduleRequest(

        /** Optional: move to a new availability slot. */
        @JsonProperty("newSlotId")
        UUID newSlotId,

        /**
         * Required when {@code newSlotId} is null.
         * When {@code newSlotId} is provided, this field is ignored
         * and the slot's startTime is used.
         */
        @JsonProperty("newScheduledAt")
        @Future(message = "New scheduled time must be in the future")
        OffsetDateTime newScheduledAt
) {}
