package rw.shcp.referrals.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateReferralRequest(
        @JsonProperty("patientId")       @NotNull  UUID   patientId,
        @JsonProperty("specialistId")              UUID   specialistId,
        @JsonProperty("consultationId")            UUID   consultationId,
        @JsonProperty("specialtyNeeded") @NotBlank String specialtyNeeded,
        @JsonProperty("reason")          @NotBlank String reason,
        @JsonProperty("urgency")                   String urgency,          // EMERGENCY | URGENT | ROUTINE
        @JsonProperty("notes")                     String notes,
        // External referral fields (required when referralType = EXTERNAL)
        @JsonProperty("referralType")              String referralType,     // INTERNAL | EXTERNAL
        @JsonProperty("institutionName")           String institutionName,
        @JsonProperty("institutionType")           String institutionType,  // HOSPITAL | SURGICAL_CENTER | CLINIC | LABORATORY | IMAGING_CENTER | REHABILITATION_CENTER
        @JsonProperty("institutionAddress")        String institutionAddress,
        @JsonProperty("institutionContact")        String institutionContact,
        @JsonProperty("treatmentType")             String treatmentType     // OPERATION | SPECIALIST_CARE | EMERGENCY | LAB_TESTS | IMAGING | PHYSIOTHERAPY | REHABILITATION | OTHER
) {}
