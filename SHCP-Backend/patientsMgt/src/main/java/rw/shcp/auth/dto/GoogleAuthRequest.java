package rw.shcp.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public record GoogleAuthRequest(
        @JsonProperty("idToken")
        @NotBlank(message = "Firebase ID token is required")
        String idToken
) {}
