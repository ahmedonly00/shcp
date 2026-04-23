package rw.shcp.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(
        @JsonProperty("refreshToken")
        @NotBlank(message = "Refresh token is required")
        String refreshToken
) {}
