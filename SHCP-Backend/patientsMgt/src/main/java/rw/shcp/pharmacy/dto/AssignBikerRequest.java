package rw.shcp.pharmacy.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AssignBikerRequest(
        @JsonProperty("bikerId")
        @NotNull
        UUID bikerId
) {}
