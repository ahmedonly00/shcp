package rw.shcp.users.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import rw.shcp.common.enums.AppointmentType;

import java.time.OffsetDateTime;
import java.util.List;

public record SetAvailabilityRequest(

                @JsonProperty("slots")
                @NotEmpty(message = "At least one slot is required") List<@Valid SlotRequest> slots) {
        public record SlotRequest(

                        @JsonProperty("startTime")
                        @NotNull(message = "Start time is required") @Future(message = "Start time must be in the future") OffsetDateTime startTime,

                        @JsonProperty("endTime")
                        @NotNull(message = "End time is required") @Future(message = "End time must be in the future") OffsetDateTime endTime,

                        @JsonProperty("appointmentType")
                        AppointmentType appointmentType) {
        }
}
