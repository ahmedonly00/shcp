package rw.shcp.appointments.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public record JoinWaitlistRequest(
        @JsonProperty("providerId") @NotNull UUID      providerId,
        @JsonProperty("date") @NotNull @Future LocalDate date,
        @JsonProperty("type") String type
) {}
