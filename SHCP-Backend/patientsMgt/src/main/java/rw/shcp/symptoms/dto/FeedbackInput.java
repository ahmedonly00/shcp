package rw.shcp.symptoms.dto;

import jakarta.validation.constraints.NotNull;

public record FeedbackInput(
        /** true = AI matched doctor's finding, false = AI was wrong */
        @NotNull Boolean wasCorrect,
        /** Optional: what the doctor actually diagnosed */
        String doctorDiagnosis
) {}
