package rw.shcp.pharmacy.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDeliveryStatusRequest(
        /** Reason for failure (required when action = FAILED). */
        @JsonProperty("failureReason")
        @Size(max = 300)
        String failureReason
) {}
