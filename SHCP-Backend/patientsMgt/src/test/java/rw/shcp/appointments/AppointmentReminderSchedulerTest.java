package rw.shcp.appointments;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import rw.shcp.common.enums.*;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AppointmentReminderSchedulerTest {

    @Mock AppointmentRepository appointmentRepository;
    @Mock NotificationPublisher notificationPublisher;

    @InjectMocks AppointmentReminderScheduler scheduler;

    // ── 24-hour reminder ──────────────────────────────────────────────────────

    @Test
    void send24HourReminders_shouldPublishPushForEachConfirmedAppointment() {
        Appointment appt = buildAppointment(OffsetDateTime.now().plusHours(24));
        when(appointmentRepository.findByScheduledAtBetweenAndStatus(
                any(), any(), eq(AppointmentStatus.CONFIRMED)))
                .thenReturn(List.of(appt));

        scheduler.send24HourReminders();

        ArgumentCaptor<NotificationEvent> captor =
                ArgumentCaptor.forClass(NotificationEvent.class);
        verify(notificationPublisher).publish(captor.capture());

        NotificationEvent event = captor.getValue();
        assertThat(event.eventType()).isEqualTo("appointment.reminder.24h");
        assertThat(event.userId()).isEqualTo(appt.getPatient().getUserId());
        assertThat(event.routingKey()).startsWith("notification.push.");
    }

    @Test
    void send24HourReminders_shouldNotPublish_whenNoUpcomingAppointments() {
        when(appointmentRepository.findByScheduledAtBetweenAndStatus(
                any(), any(), eq(AppointmentStatus.CONFIRMED)))
                .thenReturn(List.of());

        scheduler.send24HourReminders();

        verifyNoInteractions(notificationPublisher);
    }

    // ── 1-hour reminder ───────────────────────────────────────────────────────

    @Test
    void send1HourReminders_shouldPublishPushPerAppointment() {
        Appointment appt = buildAppointment(OffsetDateTime.now().plusMinutes(60));
        when(appointmentRepository.findByScheduledAtBetweenAndStatus(
                any(), any(), eq(AppointmentStatus.CONFIRMED)))
                .thenReturn(List.of(appt));

        scheduler.send1HourReminders();

        ArgumentCaptor<NotificationEvent> captor =
                ArgumentCaptor.forClass(NotificationEvent.class);
        verify(notificationPublisher, times(1)).publish(captor.capture());

        NotificationEvent event = captor.getValue();
        assertThat(event.routingKey()).startsWith("notification.push.");
        assertThat(event.eventType()).isEqualTo("appointment.reminder.1h");
    }

    @Test
    void send1HourReminders_shouldPublishForEachAppointment() {
        Appointment a1 = buildAppointment(OffsetDateTime.now().plusMinutes(55));
        Appointment a2 = buildAppointment(OffsetDateTime.now().plusMinutes(65));
        when(appointmentRepository.findByScheduledAtBetweenAndStatus(
                any(), any(), eq(AppointmentStatus.CONFIRMED)))
                .thenReturn(List.of(a1, a2));

        scheduler.send1HourReminders();

        // 2 appointments × 1 push event each = 2 publishes
        verify(notificationPublisher, times(2)).publish(any(NotificationEvent.class));
    }

    // ── fixture ───────────────────────────────────────────────────────────────

    private Appointment buildAppointment(OffsetDateTime scheduledAt) {
        UUID patientId  = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();

        User pu = new User(); pu.setUserId(patientId);  pu.setName("Alice");
        pu.setEmail("alice@test.com"); pu.setRole(Role.PATIENT); pu.setVerified(true);
        Patient patient = new Patient();
        patient.setUserId(patientId); patient.setUser(pu);

        User pvu = new User(); pvu.setUserId(providerId); pvu.setName("Dr Test");
        pvu.setEmail("dr@test.com"); pvu.setRole(Role.PROVIDER); pvu.setVerified(true);
        Provider provider = new Provider();
        provider.setUserId(providerId); provider.setUser(pvu);
        provider.setActive(true); provider.setRating(BigDecimal.valueOf(4.5));

        Appointment a = new Appointment();
        a.setAppointmentId(UUID.randomUUID());
        a.setPatient(patient);
        a.setProvider(provider);
        a.setScheduledAt(scheduledAt);
        a.setType(AppointmentType.VIDEO);
        a.setStatus(AppointmentStatus.CONFIRMED);
        return a;
    }
}
