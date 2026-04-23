package rw.shcp.consultations.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record StartConsultationRequest(
        @JsonProperty("appointmentId") @NotNull UUID appointmentId
) {}
