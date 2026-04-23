package rw.shcp.prescriptions.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record MedicationItem(
        @NotBlank String name,
        @NotBlank String dosage,
        @NotBlank String frequency,
        @Positive  int   durationDays
) {}
