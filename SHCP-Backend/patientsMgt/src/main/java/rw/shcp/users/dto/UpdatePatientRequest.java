package rw.shcp.users.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdatePatientRequest(

        @JsonProperty("name")
        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,

        @JsonProperty("phone")
        @Pattern(regexp = "^\\+?[0-9]{9,15}$", message = "Invalid phone number")
        String phone,

        @JsonProperty("languagePref")
        @Pattern(regexp = "^(rw|en|fr)$", message = "Language must be rw, en, or fr")
        String languagePref,

        /** Firebase FCM device token for push notifications. */
        @JsonProperty("deviceToken")
        String deviceToken,

        @JsonProperty("bloodType")
        @Pattern(regexp = "^(A|B|AB|O)[+-]$", message = "Invalid blood type")
        String bloodType,

        @JsonProperty("insuranceNumber")
        @Size(max = 50)
        String insuranceNumber,

        @JsonProperty("dateOfBirth")
        LocalDate dateOfBirth,

        @JsonProperty("nationalId")
        @Size(max = 20)
        String nationalId,

        @JsonProperty("gender")
        @Pattern(regexp = "^(male|female|other|prefer-not-to-say)$",
                 message = "Gender must be male, female, other, or prefer-not-to-say")
        String gender,

        @JsonProperty("emergencyContactName")
        @Size(max = 100)
        String emergencyContactName,

        @JsonProperty("emergencyContactPhone")
        @Pattern(regexp = "^(\\+?[0-9]{9,15})?$", message = "Invalid emergency contact phone")
        String emergencyContactPhone,

        @JsonProperty("insuranceProvider")
        @Size(max = 100)
        String insuranceProvider
) {}
