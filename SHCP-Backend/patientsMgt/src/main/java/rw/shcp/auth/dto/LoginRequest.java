package rw.shcp.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(

        @JsonProperty("email")
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email address")
        String email,

        @JsonProperty("password")
        @NotBlank(message = "Password is required")
        String password
) {}
