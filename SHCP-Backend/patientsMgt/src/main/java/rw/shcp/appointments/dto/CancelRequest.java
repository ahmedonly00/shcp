package rw.shcp.appointments.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CancelRequest(
        @JsonProperty("reason")
        @NotBlank(message = "Cancellation reason is required")
        @Size(max = 500)
        String reason
) {}
