package rw.shcp.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;

public record ResetPasswordRequest(
        @JsonProperty("email")
        @NotBlank @Email
        String email,

        @JsonProperty("otp")
        @NotBlank
        @Pattern(regexp = "^[0-9]{6}$", message = "OTP must be a 6-digit number")
        String otp,

        @JsonProperty("newPassword")
        @NotBlank
        @Size(min = 8, message = "Password must be at least 8 characters")
        String newPassword
) {}
