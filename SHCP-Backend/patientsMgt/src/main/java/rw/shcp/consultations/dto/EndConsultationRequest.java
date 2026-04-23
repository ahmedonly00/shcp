package rw.shcp.consultations.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Size;

public record EndConsultationRequest(
        @JsonProperty("notes") @Size(max = 5000) String notes,
        @JsonProperty("recordingUrl") String recordingUrl
) {}
