package rw.shcp.consultations;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import rw.shcp.appointments.Appointment;
import rw.shcp.appointments.AppointmentRepository;
import rw.shcp.common.enums.*;
import rw.shcp.common.exception.AppException;
import rw.shcp.consultations.dto.ConsultationDto;
import rw.shcp.consultations.dto.EndConsultationRequest;
import rw.shcp.consultations.dto.StartConsultationRequest;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConsultationServiceTest {

    @Mock ConsultationRepository consultationRepository;
    @Mock AppointmentRepository  appointmentRepository;
    @Mock NotificationPublisher  notificationPublisher;

    @InjectMocks ConsultationService consultationService;

    // ── start ─────────────────────────────────────────────────────────────────

    @Test
    void start_shouldCreateConsultation_whenAppointmentConfirmed() {
        UUID providerId = UUID.randomUUID();
        Appointment appt = buildAppointment(UUID.randomUUID(), providerId,
                AppointmentStatus.CONFIRMED);

        when(appointmentRepository.findById(appt.getAppointmentId()))
                .thenReturn(Optional.of(appt));
        when(consultationRepository.existsByAppointment_AppointmentIdAndStatusNot(
                appt.getAppointmentId(), ConsultationStatus.CANCELLED))
                .thenReturn(false);
        when(consultationRepository.save(any())).thenAnswer(inv -> {
            Consultation c = inv.getArgument(0);
            c.setConsultationId(UUID.randomUUID());
            return c;
        });
        when(appointmentRepository.save(any())).thenReturn(appt);

        ConsultationDto result = consultationService.start(
                providerId, new StartConsultationRequest(appt.getAppointmentId()));

        assertThat(result.status()).isEqualTo("IN_PROGRESS");
        assertThat(result.roomId()).isNotNull();
        assertThat(appt.getStatus()).isEqualTo(AppointmentStatus.IN_PROGRESS);
        verify(notificationPublisher, times(3)).publish(any(NotificationEvent.class));
    }

    @Test
    void start_shouldThrow_whenAppointmentNotConfirmed() {
        UUID providerId = UUID.randomUUID();
        Appointment appt = buildAppointment(UUID.randomUUID(), providerId,
                AppointmentStatus.PENDING);

        when(appointmentRepository.findById(appt.getAppointmentId()))
                .thenReturn(Optional.of(appt));

        assertThatThrownBy(() -> consultationService.start(
                providerId, new StartConsultationRequest(appt.getAppointmentId())))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Only CONFIRMED");
    }

    @Test
    void start_shouldThrowForbidden_whenNotOwnAppointment() {
        UUID providerId  = UUID.randomUUID();
        UUID otherProv   = UUID.randomUUID();
        Appointment appt = buildAppointment(UUID.randomUUID(), otherProv,
                AppointmentStatus.CONFIRMED);

        when(appointmentRepository.findById(appt.getAppointmentId()))
                .thenReturn(Optional.of(appt));

        assertThatThrownBy(() -> consultationService.start(
                providerId, new StartConsultationRequest(appt.getAppointmentId())))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("not the provider");
    }

    @Test
    void start_shouldThrowConflict_whenConsultationAlreadyExists() {
        UUID providerId = UUID.randomUUID();
        Appointment appt = buildAppointment(UUID.randomUUID(), providerId,
                AppointmentStatus.CONFIRMED);

        when(appointmentRepository.findById(appt.getAppointmentId()))
                .thenReturn(Optional.of(appt));
        when(consultationRepository.existsByAppointment_AppointmentIdAndStatusNot(
                appt.getAppointmentId(), ConsultationStatus.CANCELLED))
                .thenReturn(true);

        assertThatThrownBy(() -> consultationService.start(
                providerId, new StartConsultationRequest(appt.getAppointmentId())))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("already exists");
    }

    // ── end ───────────────────────────────────────────────────────────────────

    @Test
    void end_shouldCompleteConsultation_andTransitionAppointment() {
        UUID providerId = UUID.randomUUID();
        Consultation c  = buildConsultation(providerId, ConsultationStatus.IN_PROGRESS);

        when(consultationRepository.findById(c.getConsultationId()))
                .thenReturn(Optional.of(c));
        when(consultationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(appointmentRepository.save(any())).thenReturn(c.getAppointment());

        ConsultationDto result = consultationService.end(
                c.getConsultationId(), providerId,
                new EndConsultationRequest("Patient has mild infection", null));

        assertThat(result.status()).isEqualTo("COMPLETED");
        assertThat(result.notes()).isEqualTo("Patient has mild infection");
        assertThat(c.getAppointment().getStatus()).isEqualTo(AppointmentStatus.COMPLETED);
    }

    @Test
    void end_shouldThrow_whenAlreadyCompleted() {
        UUID providerId = UUID.randomUUID();
        Consultation c  = buildConsultation(providerId, ConsultationStatus.COMPLETED);

        when(consultationRepository.findById(c.getConsultationId()))
                .thenReturn(Optional.of(c));

        assertThatThrownBy(() -> consultationService.end(
                c.getConsultationId(), providerId,
                new EndConsultationRequest(null, null)))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Only IN_PROGRESS");
    }

    // ── getById ───────────────────────────────────────────────────────────────

    @Test
    void getById_shouldThrowForbidden_whenPatientAccessesOtherConsultation() {
        UUID otherId   = UUID.randomUUID();
        Consultation c = buildConsultation(UUID.randomUUID(), ConsultationStatus.COMPLETED);

        when(consultationRepository.findById(c.getConsultationId()))
                .thenReturn(Optional.of(c));

        assertThatThrownBy(() ->
                consultationService.getById(c.getConsultationId(), otherId, Role.PATIENT))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("do not have access");
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private Appointment buildAppointment(UUID patientId, UUID providerId,
                                          AppointmentStatus status) {
        User pu = new User(); pu.setUserId(patientId);  pu.setName("Patient");
        pu.setEmail("p@test.com"); pu.setRole(Role.PATIENT); pu.setVerified(true);
        Patient patient = new Patient();
        patient.setUserId(patientId); patient.setUser(pu);

        User pvu = new User(); pvu.setUserId(providerId); pvu.setName("Dr Test");
        pvu.setEmail("dr@test.com"); pvu.setRole(Role.PROVIDER); pvu.setVerified(true);
        Provider provider = new Provider();
        provider.setUserId(providerId); provider.setUser(pvu);
        provider.setActive(true);
        provider.setRating(BigDecimal.valueOf(4.5));

        Appointment a = new Appointment();
        a.setAppointmentId(UUID.randomUUID());
        a.setPatient(patient);
        a.setProvider(provider);
        a.setScheduledAt(OffsetDateTime.now().plusDays(1));
        a.setType(AppointmentType.VIDEO);
        a.setStatus(status);
        return a;
    }

    private Consultation buildConsultation(UUID providerId, ConsultationStatus status) {
        Appointment appt = buildAppointment(UUID.randomUUID(), providerId,
                AppointmentStatus.IN_PROGRESS);
        Consultation c = new Consultation();
        c.setConsultationId(UUID.randomUUID());
        c.setAppointment(appt);
        c.setRoomId(UUID.randomUUID().toString());
        c.setStartedAt(OffsetDateTime.now().minusMinutes(30));
        c.setStatus(status);
        return c;
    }
}
