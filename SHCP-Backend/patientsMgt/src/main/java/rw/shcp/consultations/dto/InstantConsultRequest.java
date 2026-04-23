package rw.shcp.consultations.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record InstantConsultRequest(
        @JsonProperty("providerId") @NotNull UUID providerId,
        @JsonProperty("notes") String notes
) {}
