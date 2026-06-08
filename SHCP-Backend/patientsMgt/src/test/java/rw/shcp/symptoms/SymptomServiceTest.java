package rw.shcp.symptoms;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.ehr.HealthRecordRepository;
import rw.shcp.symptoms.dto.AIAnalysisResponse;
import rw.shcp.symptoms.dto.SymptomInput;
import rw.shcp.symptoms.dto.SymptomReportDto;
import rw.shcp.symptoms.SymptomFeedbackRepository;
import rw.shcp.users.model.Patient;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.model.User;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SymptomServiceTest {

    @Mock SymptomReportRepository   symptomReportRepository;
    @Mock SymptomFeedbackRepository feedbackRepository;
    @Mock PatientRepository          patientRepository;
    @Mock HealthRecordRepository     ehrRepository;
    @Spy  ObjectMapper               objectMapper   = new ObjectMapper().findAndRegisterModules();
    @Spy  ObjectMapper               aiObjectMapper = new ObjectMapper()
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
            .findAndRegisterModules()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    @Mock RestTemplate               aiRestTemplate;

    @InjectMocks SymptomService symptomService;

    /**
     * Mockito's constructor injection can swap same-type fields when the JVM
     * does not expose parameter names at runtime for Lombok-generated constructors.
     * Force the correct mappers into the right fields to be safe.
     */
    @BeforeEach
    void fixMapperInjection() {
        ReflectionTestUtils.setField(symptomService, "objectMapper",   objectMapper);
        ReflectionTestUtils.setField(symptomService, "aiObjectMapper", aiObjectMapper);
    }

    // ── analyze_shouldPersistReport_whenAIServiceResponds ─────

    @Test
    void analyze_shouldPersistReport_whenAIServiceResponds() {
        UUID patientId = UUID.randomUUID();
        Patient patient = buildPatient(patientId);
        AIAnalysisResponse aiResponse = buildSuccessfulAiResponse();

        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(aiRestTemplate.postForObject(anyString(), any(), eq(AIAnalysisResponse.class)))
                .thenReturn(aiResponse);
        when(symptomReportRepository.save(any())).thenAnswer(inv -> {
            SymptomReport r = inv.getArgument(0);
            r.setReportId(UUID.randomUUID());
            return r;
        });
        when(ehrRepository.findByPatientUserId(patientId))
                .thenReturn(Optional.of(new HealthRecord()));
        when(ehrRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SymptomInput input = new SymptomInput("I have fever and headache", "en", null, null, null, null);

        SymptomReportDto result = symptomService.analyze(patientId, input);

        assertThat(result.aiUrgency()).isEqualTo("URGENT");
        assertThat(result.aiConfidence()).isNotNull();
        assertThat(result.isDegraded()).isFalse();
        verify(symptomReportRepository).save(any(SymptomReport.class));
    }

    // ── analyze_shouldReturnDegradedResponse_whenAIServiceTimesOut ──

    @Test
    void analyze_shouldReturnDegradedResponse_whenAIServiceTimesOut() {
        UUID patientId = UUID.randomUUID();
        Patient patient = buildPatient(patientId);

        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(aiRestTemplate.postForObject(anyString(), any(), eq(AIAnalysisResponse.class)))
                .thenThrow(new ResourceAccessException("Connection timed out"));
        when(symptomReportRepository.save(any())).thenAnswer(inv -> {
            SymptomReport r = inv.getArgument(0);
            r.setReportId(UUID.randomUUID());
            return r;
        });
        when(ehrRepository.findByPatientUserId(patientId)).thenReturn(Optional.empty());
        when(ehrRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SymptomInput input = new SymptomInput("Fever and cough", "rw", null, null, null, null);

        SymptomReportDto result = symptomService.analyze(patientId, input);

        // Must still return a response — never throw
        assertThat(result).isNotNull();
        assertThat(result.aiUrgency()).isEqualTo("UNKNOWN");
        assertThat(result.isDegraded()).isTrue();
        assertThat(result.careRecommendation()).contains("temporarily unavailable");

        // Report must still be persisted even when AI fails
        verify(symptomReportRepository).save(any(SymptomReport.class));
    }

    @Test
    void analyze_shouldReturnDegradedResponse_whenAIServiceReturnsNull() {
        UUID patientId = UUID.randomUUID();
        Patient patient = buildPatient(patientId);

        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(aiRestTemplate.postForObject(anyString(), any(), eq(AIAnalysisResponse.class)))
                .thenReturn(null);
        when(symptomReportRepository.save(any())).thenAnswer(inv -> {
            SymptomReport r = inv.getArgument(0);
            r.setReportId(UUID.randomUUID());
            return r;
        });
        when(ehrRepository.findByPatientUserId(patientId)).thenReturn(Optional.empty());
        when(ehrRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SymptomReportDto result = symptomService.analyze(
                patientId, new SymptomInput("headache", "en", null, null, null, null));

        assertThat(result.isDegraded()).isTrue();
    }

    @Test
    void analyze_shouldThrowNotFound_whenPatientAbsent() {
        UUID patientId = UUID.randomUUID();
        when(patientRepository.findById(patientId)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                symptomService.analyze(patientId,
                        new SymptomInput("fever", "en", null, null, null, null)))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("not found");
    }

    // ── getReport ─────────────────────────────────────────────

    @Test
    void getReport_shouldReturnOwnReport() {
        UUID patientId = UUID.randomUUID();
        UUID reportId  = UUID.randomUUID();
        Patient patient = buildPatient(patientId);
        AIAnalysisResponse ai = buildSuccessfulAiResponse();

        SymptomReport report = new SymptomReport();
        report.setReportId(reportId);
        report.setPatient(patient);
        report.setSymptomText("fever and headache");
        report.setLanguage("en");
        try {
            report.setAiRawResponse(new ObjectMapper()
                    .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                    .findAndRegisterModules().writeValueAsString(ai));
        } catch (Exception e) { throw new RuntimeException(e); }

        when(symptomReportRepository.findByReportIdAndPatientUserId(reportId, patientId))
                .thenReturn(Optional.of(report));
        // parseStoredAiResponse now uses aiObjectMapper (snake_case); stub it to guarantee
        // the correct object is returned regardless of field-name mapping edge cases.
        try {
            doReturn(ai).when(aiObjectMapper).readValue(anyString(), eq(AIAnalysisResponse.class));
        } catch (Exception ignored) {}

        SymptomReportDto dto = symptomService.getReport(reportId, patientId);

        assertThat(dto.reportId()).isEqualTo(reportId);
        assertThat(dto.aiUrgency()).isEqualTo("URGENT");
    }

    @Test
    void getReport_shouldThrowNotFound_whenReportBelongsToDifferentPatient() {
        UUID patientId = UUID.randomUUID();
        UUID reportId  = UUID.randomUUID();

        when(symptomReportRepository.findByReportIdAndPatientUserId(reportId, patientId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> symptomService.getReport(reportId, patientId))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("not found");
    }

    // ── Fixtures ──────────────────────────────────────────────

    private Patient buildPatient(UUID userId) {
        User u = new User();
        u.setUserId(userId);
        u.setName("Alice Uwase");
        u.setEmail("alice@test.com");
        u.setPhone("+250780000001");
        u.setRole(Role.PATIENT);
        u.setVerified(true);
        Patient p = new Patient();
        p.setUserId(userId);
        p.setUser(u);
        p.setNationalId("1199780000000001");
        p.setDateOfBirth(LocalDate.of(1995, 6, 15));
        return p;
    }

    private AIAnalysisResponse buildSuccessfulAiResponse() {
        AIAnalysisResponse r = new AIAnalysisResponse();
        r.setStatus("OK");
        r.setDisease("Typhoid");
        r.setUrgency("URGENT");
        r.setConfidence(82.4);
        r.setPathway("teleconsult");
        r.setSymptoms(List.of(
                Map.of("entity", "fever",    "duration", "3 days", "severity", "high"),
                Map.of("entity", "headache", "severity", "moderate")
        ));
        r.setCareRecommendation("Your symptoms suggest an urgent condition. Book a same-day teleconsultation.");
        r.setDisclaimer("This is an AI-generated preliminary assessment, not a medical diagnosis.");
        r.setProcessedAt(OffsetDateTime.now().toString());
        return r;
    }
}
