package rw.shcp.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyEmailRequest(
        @JsonProperty("email")
        @NotBlank @Email
        String email,

        @JsonProperty("otp")
        @NotBlank
        @Pattern(regexp = "^[0-9]{6}$", message = "OTP must be a 6-digit number")
        String otp
) {}
