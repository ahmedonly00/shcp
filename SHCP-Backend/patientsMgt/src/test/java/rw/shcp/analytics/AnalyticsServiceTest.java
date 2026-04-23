package rw.shcp.analytics;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import rw.shcp.analytics.dto.*;
import rw.shcp.common.enums.Role;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.UserRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    AnalyticsRepository analyticsRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    PatientRepository patientRepository;

    @InjectMocks
    AnalyticsService analyticsService;

    // ── platformOverview ─────────────────────────────────────────────────────

    @Test
    void platformOverview_shouldAggregateAllCounts() {
        when(userRepository.countByRole(Role.PATIENT)).thenReturn(100L);
        when(userRepository.countByRole(Role.PROVIDER)).thenReturn(20L);
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(3L);
        when(analyticsRepository.countActiveProviders()).thenReturn(18L);

        stubAppointmentCounts(10, 5, 2, 80, 3, 1);

        when(analyticsRepository.countAllConsultations()).thenReturn(75L);
        when(analyticsRepository.countCompletedConsultations()).thenReturn(70L);
        when(analyticsRepository.avgConsultationDurationMinutes()).thenReturn(22.4);
        when(analyticsRepository.countAllSymptomReports()).thenReturn(200L);
        when(analyticsRepository.countAllPrescriptions()).thenReturn(50L);
        when(analyticsRepository.countActivePrescriptions()).thenReturn(30L);

        PlatformStatsDto dto = analyticsService.platformOverview();

        assertThat(dto.totalPatients()).isEqualTo(100);
        assertThat(dto.totalProviders()).isEqualTo(20);
        assertThat(dto.activeProviders()).isEqualTo(18);
        assertThat(dto.appointments().completed()).isEqualTo(80);
        assertThat(dto.appointments().total()).isEqualTo(10 + 5 + 2 + 80 + 3 + 1);
        assertThat(dto.avgConsultationDurationMinutes()).isEqualTo(22.4);
        assertThat(dto.totalSymptomReports()).isEqualTo(200);
    }

    // ── registrationsPerDay ───────────────────────────────────────────────────

    @Test
    void registrationsPerDay_shouldMapRowsToDto() {
        when(analyticsRepository.registrationsPerDay(30))
                .thenReturn(List.of(
                        new Object[] { "2026-03-01", 5L },
                        new Object[] { "2026-03-02", 8L }));

        List<DailyCountDto> result = analyticsService.registrationsPerDay(30);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).date()).isEqualTo("2026-03-01");
        assertThat(result.get(0).count()).isEqualTo(5L);
        assertThat(result.get(1).count()).isEqualTo(8L);
    }

    @Test
    void registrationsPerDay_shouldClampDaysAbove365() {
        when(analyticsRepository.registrationsPerDay(365)).thenReturn(List.of());
        analyticsService.registrationsPerDay(9999);
        verify(analyticsRepository).registrationsPerDay(365);
    }

    @Test
    void registrationsPerDay_shouldClampDaysBelow1() {
        when(analyticsRepository.registrationsPerDay(1)).thenReturn(List.of());
        analyticsService.registrationsPerDay(0);
        verify(analyticsRepository).registrationsPerDay(1);
    }

    // ── providerStats ─────────────────────────────────────────────────────────

    @Test
    void providerStats_shouldReturnCorrectCounts() {
        UUID providerId = UUID.randomUUID();
        when(patientRepository.countDistinctByAppointments_Provider_UserId(providerId))
                .thenReturn(15L);
        stubProviderAppointmentCounts(providerId, 2, 3, 0, 40, 1, 0);
        when(analyticsRepository.countConsultationsByProvider(providerId)).thenReturn(38L);
        when(analyticsRepository.countCompletedConsultationsByProvider(providerId)).thenReturn(35L);
        when(analyticsRepository.avgConsultationDurationByProvider(providerId)).thenReturn(18.7);
        when(analyticsRepository.countPrescriptionsByProvider(providerId)).thenReturn(25L);
        when(analyticsRepository.countActivePrescriptionsByProvider(providerId)).thenReturn(10L);

        ProviderStatsDto dto = analyticsService.providerStats(providerId);

        assertThat(dto.uniquePatients()).isEqualTo(15);
        assertThat(dto.appointments().completed()).isEqualTo(40);
        assertThat(dto.totalConsultations()).isEqualTo(38);
        assertThat(dto.avgConsultationDurationMinutes()).isEqualTo(18.7);
        assertThat(dto.totalPrescriptionsIssued()).isEqualTo(25);
    }

    // ── patientHealthSummary ──────────────────────────────────────────────────

    @Test
    void patientHealthSummary_shouldReturnUrgencyBreakdown() {
        UUID patientId = UUID.randomUUID();
        stubPatientAppointmentCounts(patientId, 1, 2, 0, 5, 0, 0);
        when(analyticsRepository.countPatientUpcomingAppointments(eq(patientId),
                any(OffsetDateTime.class))).thenReturn(3L);
        when(analyticsRepository.countConsultationsByPatient(patientId)).thenReturn(5L);
        when(analyticsRepository.countSymptomReportsByPatient(patientId)).thenReturn(10L);
        when(analyticsRepository.urgencyDistributionByPatient(patientId))
                .thenReturn(List.of(
                        new Object[] { "LOW", 6L },
                        new Object[] { "MODERATE", 3L },
                        new Object[] { "URGENT", 1L }));
        when(analyticsRepository.countPrescriptionsByPatient(patientId)).thenReturn(4L);
        when(analyticsRepository.countActivePrescriptionsByPatient(patientId)).thenReturn(2L);

        PatientHealthSummaryDto dto = analyticsService.patientHealthSummary(patientId);

        assertThat(dto.totalSymptomReports()).isEqualTo(10);
        assertThat(dto.upcomingAppointments()).isEqualTo(3);
        assertThat(dto.urgencyBreakdown()).hasSize(3);
        assertThat(dto.urgencyBreakdown().get(0).urgencyLevel()).isEqualTo("LOW");
        assertThat(dto.urgencyBreakdown().get(0).count()).isEqualTo(6L);
        assertThat(dto.activePrescriptions()).isEqualTo(2);
    }

    @Test
    void patientHealthSummary_shouldHandleNullUrgencyLevel() {
        UUID patientId = UUID.randomUUID();
        stubPatientAppointmentCounts(patientId, 0, 0, 0, 0, 0, 0);
        when(analyticsRepository.countPatientUpcomingAppointments(eq(patientId),
                any(OffsetDateTime.class))).thenReturn(0L);
        when(analyticsRepository.countConsultationsByPatient(patientId)).thenReturn(0L);
        when(analyticsRepository.countSymptomReportsByPatient(patientId)).thenReturn(1L);
        when(analyticsRepository.urgencyDistributionByPatient(patientId))
                .thenReturn(List.<Object[]>of(new Object[] { null, 1L }));
        when(analyticsRepository.countPrescriptionsByPatient(patientId)).thenReturn(0L);
        when(analyticsRepository.countActivePrescriptionsByPatient(patientId)).thenReturn(0L);

        PatientHealthSummaryDto dto = analyticsService.patientHealthSummary(patientId);

        assertThat(dto.urgencyBreakdown().get(0).urgencyLevel()).isEqualTo("UNKNOWN");
    }

    // ── AppointmentBreakdownDto.total ─────────────────────────────────────────

    @Test
    void appointmentBreakdown_totalIsSumOfAllStatuses() {
        AppointmentBreakdownDto dto = AppointmentBreakdownDto.of(1, 2, 3, 4, 5, 6);
        assertThat(dto.total()).isEqualTo(21);
    }

    // ── Stub helpers ─────────────────────────────────────────────────────────

    private void stubAppointmentCounts(long pending, long confirmed, long inProgress,
            long completed, long cancelled, long noShow) {
        when(analyticsRepository.countAppointmentsPending()).thenReturn(pending);
        when(analyticsRepository.countAppointmentsConfirmed()).thenReturn(confirmed);
        when(analyticsRepository.countAppointmentsInProgress()).thenReturn(inProgress);
        when(analyticsRepository.countAppointmentsCompleted()).thenReturn(completed);
        when(analyticsRepository.countAppointmentsCancelled()).thenReturn(cancelled);
        when(analyticsRepository.countAppointmentsNoShow()).thenReturn(noShow);
    }

    private void stubProviderAppointmentCounts(UUID pid, long pending, long confirmed,
            long inProgress, long completed, long cancelled, long noShow) {
        when(analyticsRepository.countProviderAppointmentsPending(pid)).thenReturn(pending);
        when(analyticsRepository.countProviderAppointmentsConfirmed(pid)).thenReturn(confirmed);
        when(analyticsRepository.countProviderAppointmentsInProgress(pid)).thenReturn(inProgress);
        when(analyticsRepository.countProviderAppointmentsCompleted(pid)).thenReturn(completed);
        when(analyticsRepository.countProviderAppointmentsCancelled(pid)).thenReturn(cancelled);
        when(analyticsRepository.countProviderAppointmentsNoShow(pid)).thenReturn(noShow);
    }

    private void stubPatientAppointmentCounts(UUID pid, long pending, long confirmed,
            long inProgress, long completed, long cancelled, long noShow) {
        when(analyticsRepository.countPatientAppointmentsPending(pid)).thenReturn(pending);
        when(analyticsRepository.countPatientAppointmentsConfirmed(pid)).thenReturn(confirmed);
        when(analyticsRepository.countPatientAppointmentsInProgress(pid)).thenReturn(inProgress);
        when(analyticsRepository.countPatientAppointmentsCompleted(pid)).thenReturn(completed);
        when(analyticsRepository.countPatientAppointmentsCancelled(pid)).thenReturn(cancelled);
        when(analyticsRepository.countPatientAppointmentsNoShow(pid)).thenReturn(noShow);
    }
}
