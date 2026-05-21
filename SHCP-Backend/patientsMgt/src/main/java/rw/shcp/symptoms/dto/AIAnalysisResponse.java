package rw.shcp.symptoms.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

/**
 * Maps the JSON response from the Flask AI microservice.
 * The RestTemplate for this client uses snake_case naming strategy,
 * so field names map directly to Flask's JSON keys.
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class AIAnalysisResponse {

    /** OK | LOW_CONFIDENCE | NO_SYMPTOMS_DETECTED */
    private String status;

    /** Predicted disease name, e.g. "Malaria" */
    private String disease;

    /** ICD-10 code for the predicted disease, e.g. "B54". Null when unknown. */
    private String icd10;

    /** EMERGENCY | URGENT | ROUTINE | SELF_CARE | UNKNOWN */
    private String urgency;

    /** 0.0 – 100.0 */
    private Double confidence;

    /** emergency | teleconsult | appointment | self-care */
    private String pathway;

    /** Extracted symptom entities from NLP pipeline. */
    private List<Map<String, Object>> symptoms;

    /** Top-3 disease predictions [{disease, probability}] */
    @JsonProperty("top_3_predictions")
    private List<Map<String, Object>> top3Predictions;

    /**
     * SHAP-based symptom contributions driving the prediction.
     * Each entry: {symptom, contribution, direction, present}.
     * Empty list for LOW_CONFIDENCE responses.
     */
    @JsonProperty("explaining_factors")
    private List<Map<String, Object>> explainingFactors;

    /** Raw list of detected symptom column names */
    private List<String> detectedSymptoms;

    private Integer symptomCount;

    /** Human-readable recommendation in the patient's language. */
    private String careRecommendation;

    /** Recommended specialist type, e.g. "Cardiologist". Null for self-care/unknown. */
    private String specialistType;

    /** Symptom-specific self-care tips list. */
    private List<String> selfCareTips;

    /** Recommended follow-up window in days. Null for emergency/unknown. */
    private Integer followUpDays;

    private String disclaimer;

    private String processedAt;

    /** Version string of the model that produced this result, e.g. "RandomForest-v3-calibrated". */
    private String modelVersion;

    /**
     * True when Flask inferred the symptom duration from free text rather than
     * the explicit duration field in the request.
     */
    private boolean durationInferred = false;

    /**
     * Explanatory message returned by Flask for NO_SYMPTOMS_DETECTED and LOW_CONFIDENCE.
     * Null for normal OK responses.
     */
    private String message;

    /** True only when the AI service was unreachable (not just low-confidence). */
    private boolean serviceUnavailable = false;

    // ── Degraded response factory ──────────────────────────────

    public static AIAnalysisResponse degraded() {
        AIAnalysisResponse r = new AIAnalysisResponse();
        r.status           = "SERVICE_UNAVAILABLE";
        r.urgency          = "UNKNOWN";
        r.confidence       = null;
        r.pathway          = null;
        r.symptoms         = List.of();
        r.serviceUnavailable = true;
        r.careRecommendation =
                "AI service temporarily unavailable. " +
                "Please describe your symptoms directly to your healthcare provider.";
        r.disclaimer       =
                "This is an AI-generated preliminary assessment, not a medical diagnosis. " +
                "Always consult a qualified healthcare provider.";
        r.processedAt      = java.time.Instant.now().toString();
        return r;
    }

    /** True only when the AI service was unreachable — NOT for low-confidence results. */
    public boolean isDegraded() {
        return serviceUnavailable;
    }
}
