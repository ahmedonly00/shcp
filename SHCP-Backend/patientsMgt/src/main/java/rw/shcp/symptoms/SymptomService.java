package rw.shcp.symptoms;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import rw.shcp.common.exception.AppException;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.ehr.HealthRecordRepository;
import rw.shcp.symptoms.dto.AIAnalysisResponse;
import rw.shcp.symptoms.dto.SymptomInput;
import rw.shcp.symptoms.dto.SymptomReportDto;
import rw.shcp.users.model.Patient;
import rw.shcp.users.repository.PatientRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class SymptomService {

    private final SymptomReportRepository symptomReportRepository;
    private final PatientRepository patientRepository;
    private final HealthRecordRepository ehrRepository;
    private final ObjectMapper objectMapper;

    @Qualifier("aiRestTemplate")
    private final RestTemplate aiRestTemplate;

    @Value("${ai-service.base-url:http://ai-service:5000}")
    private String aiBaseUrl;

    // ── Analyze ───────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PATIENT')")
    public SymptomReportDto analyze(UUID patientUserId, SymptomInput input) {
        Patient patient = patientRepository.findById(patientUserId)
                .orElseThrow(() -> AppException.notFound("Patient profile not found"));

        AIAnalysisResponse aiResponse = callAIService(patient, input);

        SymptomReport report = buildReport(patient, input, aiResponse);
        SymptomReport saved = symptomReportRepository.save(report);

        // Reflect the latest AI urgency finding in the EHR (non-blocking on failure)
        try {
            appendToEhr(patient, aiResponse, saved.getReportId());
        } catch (Exception e) {
            log.warn("EHR update failed after symptom analysis (report={}): {}",
                    saved.getReportId(), e.getMessage());
        }

        log.info("Symptom report {} saved for patient {} (urgency={})",
                saved.getReportId(), patientUserId, aiResponse.getUrgency());

        // When AI returned no extracted symptoms, inject user-submitted ones so the DTO
        // returned to the frontend always has a populated symptoms list.
        if ((aiResponse.getSymptoms() == null || aiResponse.getSymptoms().isEmpty())
                && input.symptoms() != null && !input.symptoms().isEmpty()) {
            List<Map<String, Object>> fallback = input.symptoms().stream()
                    .map(s -> Map.<String, Object>of("name", s))
                    .toList();
            aiResponse.setSymptoms(fallback);
        }

        return SymptomReportDto.from(saved, aiResponse);
    }

    // ── Get report ────────────────────────────────────────────

    @PreAuthorize("hasRole('PATIENT')")
    public SymptomReportDto getReport(UUID reportId, UUID patientUserId) {
        SymptomReport report = symptomReportRepository
                .findByReportIdAndPatientUserId(reportId, patientUserId)
                .orElseThrow(() -> AppException.notFound("Symptom report not found"));

        // Reconstruct AI response from stored raw JSON for the DTO
        AIAnalysisResponse ai = parseStoredAiResponse(report);

        // When AI had no extracted symptoms, use the stored report symptoms
        // (which may be user-submitted fallback written by buildReport).
        if ((ai.getSymptoms() == null || ai.getSymptoms().isEmpty())
                && report.getSymptoms() != null) {
            try {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> stored = objectMapper.readValue(
                        report.getSymptoms(),
                        objectMapper.getTypeFactory()
                                .constructCollectionType(List.class, Map.class));
                if (!stored.isEmpty()) {
                    ai.setSymptoms(stored);
                }
            } catch (JsonProcessingException ignored) {}
        }

        return SymptomReportDto.from(report, ai);
    }

    // ── AI service call (with graceful degradation) ───────────

    private AIAnalysisResponse callAIService(Patient patient, SymptomInput input) {
        Map<String, Object> body = new HashMap<>();
        body.put("patient_id", patient.getUserId().toString());
        body.put("symptom_text", input.symptomText());
        body.put("language", input.language() != null ? input.language() : "rw");
        body.put("body_map_data", input.bodyMapData() != null ? input.bodyMapData() : Map.of());
        if (input.symptoms() != null && !input.symptoms().isEmpty()) {
            body.put("symptoms", input.symptoms());
        }
        if (input.severity() != null) {
            body.put("severity", input.severity());
        }
        if (input.duration() != null) {
            body.put("duration", input.duration());
        }

        // Pass demographics so the AI service can apply age/sex-aware urgency rules
        if (patient.getDateOfBirth() != null) {
            int age = Period.between(patient.getDateOfBirth(), LocalDate.now()).getYears();
            body.put("patient_age", age);
        }
        if (patient.getGender() != null && !patient.getGender().isBlank()) {
            body.put("patient_sex", patient.getGender().toLowerCase());
        }

        try {
            AIAnalysisResponse response = aiRestTemplate.postForObject(
                    aiBaseUrl + "/analyze", body, AIAnalysisResponse.class);

            if (response == null) {
                log.warn("AI service returned null response");
                return AIAnalysisResponse.degraded();
            }
            return response;

        } catch (ResourceAccessException e) {
            // Connect timeout or read timeout
            log.warn("AI service timeout ({}): {}", aiBaseUrl, e.getMessage());
            return AIAnalysisResponse.degraded();
        } catch (Exception e) {
            log.error("AI service call failed: {}", e.getMessage());
            return AIAnalysisResponse.degraded();
        }
    }

    // ── Helpers ───────────────────────────────────────────────

    private SymptomReport buildReport(Patient patient, SymptomInput input,
            AIAnalysisResponse ai) {
        SymptomReport report = new SymptomReport();
        report.setPatient(patient);
        report.setSymptomText(input.symptomText());
        report.setLanguage(input.language() != null ? input.language() : "rw");

        if (input.bodyMapData() != null) {
            report.setBodyMapData(toJson(input.bodyMapData()));
        }

        // Prefer AI-extracted symptoms; fall back to user-submitted list so the stored
        // symptoms column is never empty on degraded responses.
        if (ai.getSymptoms() != null && !ai.getSymptoms().isEmpty()) {
            report.setSymptoms(toJson(ai.getSymptoms()));
        } else if (input.symptoms() != null && !input.symptoms().isEmpty()) {
            List<Map<String, Object>> fallback = input.symptoms().stream()
                    .map(name -> Map.<String, Object>of("name", name))
                    .toList();
            report.setSymptoms(toJson(fallback));
        }

        report.setAiUrgency(ai.getUrgency());
        report.setAiPathway(ai.getPathway());
        report.setAiConfidence(
                ai.getConfidence() != null ? BigDecimal.valueOf(ai.getConfidence()) : null);
        report.setCareRecommendation(ai.getCareRecommendation());
        report.setAiRawResponse(toJson(ai));
        return report;
    }

    private void appendToEhr(Patient patient, AIAnalysisResponse ai, UUID reportId) {
        HealthRecord ehr = ehrRepository.findByPatientUserId(patient.getUserId())
                .orElseGet(() -> {
                    HealthRecord h = new HealthRecord();
                    h.setPatient(patient);
                    return h;
                });

        // ── 1. Update vitals with latest AI summary ───────────────────────────
        Map<String, Object> vitalsUpdate;
        try {
            vitalsUpdate = objectMapper.readValue(
                    ehr.getVitals() != null ? ehr.getVitals() : "{}",
                    objectMapper.getTypeFactory().constructMapType(HashMap.class, String.class, Object.class));
        } catch (JsonProcessingException e) {
            vitalsUpdate = new HashMap<>();
        }
        vitalsUpdate.put("last_ai_urgency", ai.getUrgency());
        vitalsUpdate.put("last_ai_pathway", ai.getPathway());
        vitalsUpdate.put("last_symptom_report", reportId.toString());
        ehr.setVitals(toJson(vitalsUpdate));

        // ── 2. For high-confidence OK results, add a diagnoses entry ──────────
        // Only write to diagnoses when the AI is confident (≥50%) so the Health
        // Records tab stays clean. The entry is clearly labelled "AI Screening"
        // so it is never confused with a confirmed clinical diagnosis.
        if (!ai.isDegraded()
                && "OK".equals(ai.getStatus())
                && ai.getDisease() != null
                && ai.getConfidence() != null
                && ai.getConfidence() >= 50.0) {

            List<Map<String, Object>> diagnoses;
            try {
                diagnoses = objectMapper.readValue(
                        ehr.getDiagnoses() != null ? ehr.getDiagnoses() : "[]",
                        objectMapper.getTypeFactory().constructCollectionType(ArrayList.class, Map.class));
            } catch (JsonProcessingException e) {
                diagnoses = new ArrayList<>();
            }

            // Avoid duplicate entries for the same report
            boolean alreadyPresent = diagnoses.stream()
                    .anyMatch(d -> reportId.toString().equals(d.get("reportId")));

            if (!alreadyPresent) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("name", ai.getDisease());
                entry.put("source", "AI Screening");
                if (ai.getIcd10() != null) entry.put("icd10", ai.getIcd10());
                entry.put("confidence", String.format("%.0f%%", ai.getConfidence()));
                entry.put("urgency", ai.getUrgency());
                if (ai.getCareRecommendation() != null)
                    entry.put("notes", ai.getCareRecommendation());
                entry.put("date", LocalDate.now().toString());
                entry.put("reportId", reportId.toString());
                diagnoses.add(entry);
                ehr.setDiagnoses(toJson(diagnoses));
            }
        }

        ehrRepository.save(ehr);
    }

    private AIAnalysisResponse parseStoredAiResponse(SymptomReport report) {
        if (report.getAiRawResponse() == null) {
            return AIAnalysisResponse.degraded();
        }
        try {
            return objectMapper.readValue(report.getAiRawResponse(), AIAnalysisResponse.class);
        } catch (JsonProcessingException e) {
            log.warn("Could not parse stored AI response for report {}", report.getReportId());
            return AIAnalysisResponse.degraded();
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("JSON serialisation failed: {}", e.getMessage());
            return "{}";
        }
    }
}
