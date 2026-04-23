package rw.shcp.analytics;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import rw.shcp.analytics.dto.*;
import rw.shcp.common.SecurityContextHelper;
import rw.shcp.common.TestSecurityConfig;
import rw.shcp.common.enums.Role;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AnalyticsController.class)
@Import(TestSecurityConfig.class)
class AnalyticsControllerTest {

    @Autowired MockMvc      mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean AnalyticsService analyticsService;

    @AfterEach
    void tearDown() { SecurityContextHelper.clear(); }

    // ── GET /api/analytics/admin/overview ────────────────────────────────────

    @Test
    void adminOverview_shouldReturn200_withStats() throws Exception {
        SecurityContextHelper.mockUser(UUID.randomUUID(), Role.ADMIN);
        AppointmentBreakdownDto appts = AppointmentBreakdownDto.of(1, 2, 0, 10, 1, 0);
        PlatformStatsDto dto = new PlatformStatsDto(
                100, 20, 3, 18, appts, 75, 70, 22.0, 200, 50, 30);
        when(analyticsService.platformOverview()).thenReturn(dto);

        mockMvc.perform(get("/api/analytics/admin/overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalPatients").value(100))
                .andExpect(jsonPath("$.data.activeProviders").value(18))
                .andExpect(jsonPath("$.data.appointments.completed").value(10));
    }

    // ── GET /api/analytics/admin/registrations ────────────────────────────────

    @Test
    void registrations_shouldReturn200_withDailyData() throws Exception {
        SecurityContextHelper.mockUser(UUID.randomUUID(), Role.ADMIN);
        when(analyticsService.registrationsPerDay(30))
                .thenReturn(List.of(new DailyCountDto("2026-03-01", 5L)));

        mockMvc.perform(get("/api/analytics/admin/registrations?days=30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].date").value("2026-03-01"))
                .andExpect(jsonPath("$.data[0].count").value(5));
    }

    @Test
    void registrations_shouldUseDefaultDays30_whenParamAbsent() throws Exception {
        SecurityContextHelper.mockUser(UUID.randomUUID(), Role.ADMIN);
        when(analyticsService.registrationsPerDay(30)).thenReturn(List.of());

        mockMvc.perform(get("/api/analytics/admin/registrations"))
                .andExpect(status().isOk());

        verify(analyticsService).registrationsPerDay(30);
    }

    // ── GET /api/analytics/provider/me ───────────────────────────────────────

    @Test
    void providerStats_shouldReturn200() throws Exception {
        UUID providerId = UUID.randomUUID();
        SecurityContextHelper.mockUser(providerId, Role.PROVIDER);
        AppointmentBreakdownDto appts = AppointmentBreakdownDto.of(0, 1, 0, 40, 1, 0);
        ProviderStatsDto dto = new ProviderStatsDto(15, appts, 38, 35, 18.7, 25, 10);
        when(analyticsService.providerStats(providerId)).thenReturn(dto);

        mockMvc.perform(get("/api/analytics/provider/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.uniquePatients").value(15))
                .andExpect(jsonPath("$.data.totalConsultations").value(38));
    }

    // ── GET /api/analytics/patient/me ────────────────────────────────────────

    @Test
    void patientSummary_shouldReturn200() throws Exception {
        UUID patientId = UUID.randomUUID();
        SecurityContextHelper.mockUser(patientId, Role.PATIENT);
        AppointmentBreakdownDto appts = AppointmentBreakdownDto.of(1, 2, 0, 5, 0, 0);
        PatientHealthSummaryDto dto = new PatientHealthSummaryDto(
                appts, 3L, 5L, 10L,
                List.of(new UrgencyDistributionDto("LOW", 6L)),
                4L, 2L);
        when(analyticsService.patientHealthSummary(patientId)).thenReturn(dto);

        mockMvc.perform(get("/api/analytics/patient/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalSymptomReports").value(10))
                .andExpect(jsonPath("$.data.urgencyBreakdown[0].urgencyLevel").value("LOW"));
    }
}
