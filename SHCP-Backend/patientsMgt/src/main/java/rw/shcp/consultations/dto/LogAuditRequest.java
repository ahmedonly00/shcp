package rw.shcp.consultations.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LogAuditRequest(
        @JsonProperty("eventType") @NotBlank @Size(max = 50) String eventType,
        @JsonProperty("metadata")  @Size(max = 2000) String metadata
) {}
