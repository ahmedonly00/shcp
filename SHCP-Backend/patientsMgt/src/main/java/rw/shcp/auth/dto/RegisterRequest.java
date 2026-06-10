package rw.shcp.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import rw.shcp.common.enums.Role;

import java.time.LocalDate;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RegisterRequest(

        // ── Common fields ──────────────────────────────────────
        @JsonProperty("name")
        @NotBlank(message = "Name is required")
        @Size(max = 100)
        String name,

        @JsonProperty("email")
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email address")
        @Size(max = 150)
        String email,

        @JsonProperty("phone")
        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^\\+250[0-9]{9,10}$", message = "Phone must be a Rwanda number in the format +250XXXXXXXXX")
        String phone,

        @JsonProperty("password")
        @NotBlank(message = "Password is required")
        @Size(min = 8, message = "Password must be at least 8 characters")
        String password,

        @JsonProperty("role")
        @NotNull(message = "Role is required")
        Role role,

        @JsonProperty("languagePref")
        @Pattern(regexp = "^(rw|en|fr)$", message = "Language must be rw, en, or fr")
        String languagePref,

        // ── Patient-specific (required when role = PATIENT) ───
        @JsonProperty("dateOfBirth")
        LocalDate dateOfBirth,
        @JsonProperty("bloodType")
        String bloodType,
        @JsonProperty("insuranceNumber")
        String insuranceNumber,
        @JsonProperty("nationalId")
        @Size(min = 16, max = 16, message = "National ID must be exactly 16 digits")
        @Pattern(regexp = "^[0-9]{16}$", message = "National ID must be exactly 16 digits")
        String nationalId,

        // ── Provider-specific (required when role = PROVIDER) ─
        @JsonProperty("licenseNumber")
        String licenseNumber,
        @JsonProperty("specialty")
        String specialty,
        @JsonProperty("facility")
        String facility,

        // ── Pharmacist-specific (required when role = PHARMACIST) ─
        @JsonProperty("pharmacyId")
        java.util.UUID pharmacyId,

        // ── Biker-specific (required when role = BIKER) ──────────
        @JsonProperty("vehicleType")
        String vehicleType,
        @JsonProperty("operatingZone")
        String operatingZone,
        @JsonProperty("bikerLicenseNumber")
        String bikerLicenseNumber
) {}
