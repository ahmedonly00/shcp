package rw.shcp.symptoms.dto;

import rw.shcp.symptoms.SymptomReport;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record SymptomReportDto(
        UUID                        reportId,
        UUID                        patientId,
        String                      symptomText,
        String                      language,
        String                      aiUrgency,
        String                      aiPathway,
        String                      aiDisease,
        /** ICD-10 code for the predicted disease, e.g. "B54". Null when not available. */
        String                      icd10,
        BigDecimal                  aiConfidence,
        List<Map<String, Object>>   symptoms,
        String                      careRecommendation,
        /** Recommended specialist type, e.g. "Cardiologist". Null when not applicable. */
        String                      specialistType,
        /** Symptom-specific self-care tips. Empty list when not applicable. */
        List<String>                selfCareTips,
        /** Recommended follow-up window in days. Null for emergency/unknown. */
        Integer                     followUpDays,
        /** Top-3 differential predictions [{disease, probability}] from the AI model. */
        List<Map<String, Object>>   top3Predictions,
        String                      disclaimer,
        /** Non-null when Flask returned NO_SYMPTOMS_DETECTED or LOW_CONFIDENCE. */
        String                      message,
        boolean                     isDegraded,
        OffsetDateTime              createdAt
) {
    public static SymptomReportDto from(SymptomReport report, AIAnalysisResponse ai) {
        return new SymptomReportDto(
                report.getReportId(),
                report.getPatient().getUserId(),
                report.getSymptomText(),
                report.getLanguage(),
                ai.getUrgency(),
                ai.getPathway(),
                ai.getDisease(),
                ai.getIcd10(),
                ai.getConfidence() != null
                        ? BigDecimal.valueOf(ai.getConfidence()) : null,
                ai.getSymptoms() != null ? ai.getSymptoms() : List.of(),
                ai.getCareRecommendation(),
                ai.getSpecialistType(),
                ai.getSelfCareTips() != null ? ai.getSelfCareTips() : List.of(),
                ai.getFollowUpDays(),
                ai.getTop3Predictions() != null ? ai.getTop3Predictions() : List.of(),
                ai.getDisclaimer(),
                ai.getMessage(),
                ai.isDegraded(),
                report.getCreatedAt()
        );
    }
}
