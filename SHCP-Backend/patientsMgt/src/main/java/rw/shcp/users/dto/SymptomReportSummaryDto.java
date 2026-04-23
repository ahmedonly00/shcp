package rw.shcp.users.dto;

import rw.shcp.symptoms.SymptomReport;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public record SymptomReportSummaryDto(
        UUID           reportId,
        UUID           patientId,
        String         symptomText,
        String         language,
        String         aiUrgency,
        String         aiPathway,
        /** Top-1 predicted disease name. Null if the report pre-dates this field. */
        String         aiDisease,
        /** ICD-10 code for the top-1 disease, e.g. "B54". */
        String         icd10,
        BigDecimal     aiConfidence,
        String         careRecommendation,
        /** Canonical symptom names detected by the AI (from the stored symptoms column). */
        List<String>   symptoms,
        /** Always false for stored records — only true for live degraded responses. */
        boolean        isDegraded,
        OffsetDateTime createdAt
) {
    private static final Pattern DISEASE_RE =
            Pattern.compile("\"disease\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern ICD10_RE =
            Pattern.compile("\"icd10\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern SYM_NAME_RE =
            Pattern.compile("\"name\"\\s*:\\s*\"([^\"]+)\"");

    public static SymptomReportSummaryDto from(SymptomReport r) {
        String raw     = r.getAiRawResponse();
        String disease = extractFirst(raw, DISEASE_RE);
        String icd10   = extractFirst(raw, ICD10_RE);

        // Extract symptom name strings from the stored symptoms JSONB, e.g.
        // [{"name":"high_fever",...},{"name":"headache",...}]
        List<String> symptomNames = extractAll(r.getSymptoms(), SYM_NAME_RE);

        return new SymptomReportSummaryDto(
                r.getReportId(),
                r.getPatient().getUserId(),
                r.getSymptomText(),
                r.getLanguage(),
                r.getAiUrgency(),
                r.getAiPathway(),
                disease,
                icd10,
                r.getAiConfidence(),
                r.getCareRecommendation(),
                symptomNames,
                false,
                r.getCreatedAt()
        );
    }

    /** Extract the first capture group of a pattern from a JSON string. */
    private static String extractFirst(String json, Pattern p) {
        if (json == null || json.isBlank()) return null;
        Matcher m = p.matcher(json);
        return m.find() ? m.group(1) : null;
    }

    /** Extract all capture groups of a pattern from a JSON string. */
    private static List<String> extractAll(String json, Pattern p) {
        if (json == null || json.isBlank()) return List.of();
        Matcher m = p.matcher(json);
        List<String> results = new java.util.ArrayList<>();
        while (m.find()) results.add(m.group(1));
        return List.copyOf(results);
    }
}
