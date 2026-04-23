package rw.shcp.symptoms.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record SymptomInput(

        @JsonProperty("symptomText")
        @NotBlank(message = "Symptom description is required")
        @Size(max = 2000, message = "Symptom text must not exceed 2000 characters")
        String symptomText,

        @JsonProperty("language")
        @Pattern(regexp = "^(rw|en|fr)$", message = "Language must be rw, en, or fr")
        String language,

        @JsonProperty("bodyMapData")
        Map<String, Object> bodyMapData,

        /** Pre-parsed symptom names from frontend tag selection, e.g. ["Fever","Headache"] */
        @JsonProperty("symptoms")
        List<String> symptoms,

        /** Patient-reported severity: "mild" | "moderate" | "severe" */
        @JsonProperty("severity")
        String severity,

        /** Patient-reported duration, e.g. "less-than-1-day" | "1-3-days" | "more-than-2-weeks" */
        @JsonProperty("duration")
        String duration
) {}
