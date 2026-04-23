package rw.shcp.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @JsonProperty("currentPassword") @NotBlank String currentPassword,
        @JsonProperty("newPassword") @NotBlank @Size(min = 6, message = "New password must be at least 6 characters") String newPassword
) {}
