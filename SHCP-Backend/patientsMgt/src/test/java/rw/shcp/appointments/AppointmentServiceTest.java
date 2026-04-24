package rw.shcp.appointments;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import rw.shcp.appointments.dto.*;
import rw.shcp.common.enums.*;
import rw.shcp.common.exception.AppException;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.symptoms.SymptomReportRepository;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.User;
import rw.shcp.users.model.Provider;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AppointmentServiceTest {

    @Mock AppointmentRepository     appointmentRepository;
    @Mock AvailabilityRepository    availabilityRepository;
    @Mock PatientRepository         patientRepository;
    @Mock ProviderRepository        providerRepository;
    @Mock NotificationPublisher     notificationPublisher;
    @Mock rw.shcp.appointments.WaitlistService waitlistService;
    @Mock SymptomReportRepository   symptomReportRepository;

    @InjectMocks AppointmentService appointmentService;

    // ── bookAppointment ───────────────────────────────────────

    @Test
    void bookAppointment_shouldReturnConfirmed_whenSlotAvailable() {
        UUID patientId  = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();
        UUID slotId     = UUID.randomUUID();

        Patient  patient  = buildPatient(patientId);
        Provider provider = buildProvider(providerId);
        Availability slot = buildSlot(slotId, provider, false);

        when(symptomReportRepository.existsByPatientUserId(patientId)).thenReturn(true);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(provider));
        when(availabilityRepository.findById(slotId)).thenReturn(Optional.of(slot));
        when(appointmentRepository.existsByProviderUserIdAndScheduledAt(any(), any()))
                .thenReturn(false);
        when(appointmentRepository.save(any())).thenAnswer(inv -> {
            Appointment a = inv.getArgument(0);
            a.setAppointmentId(UUID.randomUUID());
            return a;
        });
        when(availabilityRepository.save(any())).thenReturn(slot);

        BookingRequest req = new BookingRequest(
                providerId, slotId, null, AppointmentType.VIDEO, BigDecimal.valueOf(5000), null);

        AppointmentDto result = appointmentService.book(patientId, req);

        assertThat(result.status()).isEqualTo("CONFIRMED");
        assertThat(result.providerId()).isEqualTo(providerId);
        verify(appointmentRepository).save(any(Appointment.class));
        // slot must be marked as booked
        assertThat(slot.isBooked()).isTrue();
    }

    @Test
    void bookAppointment_shouldThrowConflict_whenSlotAlreadyBooked() {
        UUID patientId  = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();
        UUID slotId     = UUID.randomUUID();

        Patient  patient  = buildPatient(patientId);
        Provider provider = buildProvider(providerId);
        Availability slot = buildSlot(slotId, provider, true); // already booked

        when(symptomReportRepository.existsByPatientUserId(patientId)).thenReturn(true);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(provider));
        when(availabilityRepository.findById(slotId)).thenReturn(Optional.of(slot));

        BookingRequest req = new BookingRequest(
                providerId, slotId, null, AppointmentType.VIDEO, null, null);

        assertThatThrownBy(() -> appointmentService.book(patientId, req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("already been booked");
    }

    @Test
    void bookAppointment_shouldThrowConflict_whenDoubleBooking() {
        UUID patientId  = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();
        OffsetDateTime scheduledAt = OffsetDateTime.now().plusDays(1);

        Patient  patient  = buildPatient(patientId);
        Provider provider = buildProvider(providerId);

        when(symptomReportRepository.existsByPatientUserId(patientId)).thenReturn(true);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(provider));
        when(appointmentRepository.existsByProviderUserIdAndScheduledAt(
                eq(providerId), eq(scheduledAt))).thenReturn(true);

        BookingRequest req = new BookingRequest(
                providerId, null, scheduledAt, AppointmentType.VIDEO, null, null);

        assertThatThrownBy(() -> appointmentService.book(patientId, req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("already has an appointment");
    }

    @Test
    void bookAppointment_shouldThrow_whenProviderInactive() {
        UUID patientId  = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();

        Patient  patient  = buildPatient(patientId);
        Provider provider = buildProvider(providerId);
        provider.setActive(false);

        when(symptomReportRepository.existsByPatientUserId(patientId)).thenReturn(true);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(provider));

        BookingRequest req = new BookingRequest(
                providerId, null, OffsetDateTime.now().plusDays(1),
                AppointmentType.VIDEO, null, null);

        assertThatThrownBy(() -> appointmentService.book(patientId, req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("not currently accepting");
    }

    @Test
    void bookAppointment_shouldPublishNotificationEvents_afterSaving() {
        UUID patientId  = UUID.randomUUID();
        UUID providerId = UUID.randomUUID();
        OffsetDateTime scheduledAt = OffsetDateTime.now().plusDays(1);

        Patient  patient  = buildPatient(patientId);
        Provider provider = buildProvider(providerId);

        when(symptomReportRepository.existsByPatientUserId(patientId)).thenReturn(true);
        when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(provider));
        when(appointmentRepository.existsByProviderUserIdAndScheduledAt(any(), any()))
                .thenReturn(false);
        when(appointmentRepository.save(any())).thenAnswer(inv -> {
            Appointment a = inv.getArgument(0);
            a.setAppointmentId(UUID.randomUUID());
            return a;
        });

        appointmentService.book(patientId,
                new BookingRequest(providerId, null, scheduledAt, AppointmentType.VIDEO, null, null));

        // email (patient) + sms (patient) + email (provider) = 3 events
        verify(notificationPublisher, times(3)).publish(any(NotificationEvent.class));
    }

    // ── cancelAppointment ─────────────────────────────────────

    @Test
    void cancelAppointment_shouldUpdateStatus_whenOwnAppointment() {
        UUID patientId = UUID.randomUUID();
        Appointment appt = buildAppointment(patientId, UUID.randomUUID(),
                AppointmentStatus.CONFIRMED);
        when(appointmentRepository.findById(appt.getAppointmentId()))
                .thenReturn(Optional.of(appt));
        when(appointmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AppointmentDto result = appointmentService.cancel(
                appt.getAppointmentId(), patientId,
                Role.PATIENT, new CancelRequest("Schedule conflict"));

        assertThat(result.status()).isEqualTo("CANCELLED");
        assertThat(result.cancellationReason()).isEqualTo("Schedule conflict");
    }

    @Test
    void cancelAppointment_shouldThrowForbidden_whenNotOwner() {
        UUID patientId  = UUID.randomUUID();
        UUID otherId    = UUID.randomUUID();
        Appointment appt = buildAppointment(patientId, UUID.randomUUID(),
                AppointmentStatus.CONFIRMED);
        when(appointmentRepository.findById(appt.getAppointmentId()))
                .thenReturn(Optional.of(appt));

        assertThatThrownBy(() -> appointmentService.cancel(
                appt.getAppointmentId(), otherId,
                Role.PATIENT, new CancelRequest("reason")))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("do not have access");
    }

    @Test
    void cancelAppointment_shouldThrow_whenAlreadyCancelled() {
        UUID patientId = UUID.randomUUID();
        Appointment appt = buildAppointment(patientId, UUID.randomUUID(),
                AppointmentStatus.CANCELLED);
        when(appointmentRepository.findById(appt.getAppointmentId()))
                .thenReturn(Optional.of(appt));

        assertThatThrownBy(() -> appointmentService.cancel(
                appt.getAppointmentId(), patientId,
                Role.PATIENT, new CancelRequest("double cancel")))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("already cancelled");
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

    private Provider buildProvider(UUID userId) {
        User u = new User();
        u.setUserId(userId);
        u.setName("Dr. Kalisa Jean");
        u.setEmail("kalisa@test.com");
        u.setPhone("+250788000001");
        u.setRole(Role.PROVIDER);
        u.setVerified(true);
        Provider pv = new Provider();
        pv.setUserId(userId);
        pv.setUser(u);
        pv.setLicenseNumber("RW-MED-001");
        pv.setSpecialty("General Medicine");
        pv.setActive(true);
        pv.setRating(BigDecimal.valueOf(4.5));
        return pv;
    }

    private Availability buildSlot(UUID slotId, Provider provider, boolean booked) {
        Availability slot = new Availability();
        slot.setSlotId(slotId);
        slot.setProvider(provider);
        slot.setStartTime(OffsetDateTime.now().plusDays(1));
        slot.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
        slot.setBooked(booked);
        slot.setAppointmentType(AppointmentType.VIDEO);
        return slot;
    }

    private Appointment buildAppointment(UUID patientId, UUID providerId,
                                          AppointmentStatus status) {
        Patient  patient  = buildPatient(patientId);
        Provider provider = buildProvider(providerId);
        Appointment a = new Appointment();
        a.setAppointmentId(UUID.randomUUID());
        a.setPatient(patient);
        a.setProvider(provider);
        a.setScheduledAt(OffsetDateTime.now().plusDays(1));
        a.setType(AppointmentType.VIDEO);
        a.setStatus(status);
        return a;
    }
}
