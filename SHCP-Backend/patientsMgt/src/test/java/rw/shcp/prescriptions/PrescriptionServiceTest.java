package rw.shcp.prescriptions;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import rw.shcp.common.enums.*;
import rw.shcp.common.exception.AppException;
import rw.shcp.consultations.Consultation;
import rw.shcp.consultations.ConsultationRepository;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.ehr.HealthRecordRepository;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.pharmacy.PharmacyService;
import rw.shcp.prescriptions.dto.IssuePrescriptionRequest;
import rw.shcp.prescriptions.dto.MedicationItem;
import rw.shcp.prescriptions.dto.PrescriptionDto;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PrescriptionServiceTest {

        @Mock
        PrescriptionRepository prescriptionRepository;
        @Mock
        ConsultationRepository consultationRepository;
        @Mock
        PatientRepository patientRepository;
        @Mock
        ProviderRepository providerRepository;
        @Mock
        HealthRecordRepository healthRecordRepository;
        @Mock
        PharmacyService pharmacyService;
        @Mock
        NotificationPublisher notificationPublisher;
        @Mock
        ApplicationEventPublisher eventPublisher;
        @Spy
        ObjectMapper objectMapper = new ObjectMapper();

        @InjectMocks
        PrescriptionService prescriptionService;

        // ── issue ─────────────────────────────────────────────────────────────────

        @Test
        void issue_shouldSavePrescription_andUpdateEhr() {
                UUID providerId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();

                Provider provider = buildProvider(providerId);
                Patient patient = buildPatient(patientId);
                HealthRecord ehr = buildEhr(patient);

                when(providerRepository.findById(providerId)).thenReturn(Optional.of(provider));
                when(patientRepository.findById(patientId)).thenReturn(Optional.of(patient));
                when(healthRecordRepository.findByPatientUserId(patientId))
                                .thenReturn(Optional.of(ehr));
                when(healthRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
                when(prescriptionRepository.save(any())).thenAnswer(inv -> {
                        Prescription p = inv.getArgument(0);
                        p.setPrescriptionId(UUID.randomUUID());
                        return p;
                });
                when(pharmacyService.resolveNearest(any(), any(), any(), any(), any(), any()))
                                .thenThrow(AppException.notFound("No pharmacy available near delivery address"));

                IssuePrescriptionRequest req = new IssuePrescriptionRequest(
                                null, patientId,
                                List.of(new MedicationItem("Amoxicillin", "500mg", "3x/day", 7)),
                                "Take with food", 30, null,
                                null, null, null, null, null, null);

                PrescriptionDto result = prescriptionService.issue(providerId, req);

                assertThat(result.status()).isEqualTo("PENDING");
                assertThat(result.patientId()).isEqualTo(patientId);
                verify(prescriptionRepository).save(any(Prescription.class));
                // EHR medications should be updated
                verify(healthRecordRepository).save(any(HealthRecord.class));
                // Prescription event published via Spring event bus (listener handles
                // notifications)
                verify(eventPublisher).publishEvent(any(PrescriptionIssuedEvent.class));
        }

        @Test
        void issue_shouldThrow_whenPatientNotFound() {
                UUID providerId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();

                when(providerRepository.findById(providerId))
                                .thenReturn(Optional.of(buildProvider(providerId)));
                when(patientRepository.findById(patientId)).thenReturn(Optional.empty());

                IssuePrescriptionRequest req = new IssuePrescriptionRequest(
                                null, patientId,
                                List.of(new MedicationItem("Drug", "100mg", "1x/day", 5)),
                                null, 14, null,
                                null, null, null, null, null, null);

                assertThatThrownBy(() -> prescriptionService.issue(providerId, req))
                                .isInstanceOf(AppException.class)
                                .hasMessageContaining("Patient not found");
        }

        @Test
        void issue_withConsultation_shouldThrowForbidden_whenProviderMismatch() {
                UUID providerId = UUID.randomUUID();
                UUID otherProviderId = UUID.randomUUID();
                UUID patientId = UUID.randomUUID();
                UUID consultationId = UUID.randomUUID();

                when(providerRepository.findById(providerId))
                                .thenReturn(Optional.of(buildProvider(providerId)));
                when(patientRepository.findById(patientId))
                                .thenReturn(Optional.of(buildPatient(patientId)));

                Consultation c = buildConsultation(consultationId, otherProviderId, patientId);
                when(consultationRepository.findById(consultationId)).thenReturn(Optional.of(c));

                IssuePrescriptionRequest req = new IssuePrescriptionRequest(
                                consultationId, patientId,
                                List.of(new MedicationItem("Drug", "100mg", "1x/day", 5)),
                                null, 14, null,
                                null, null, null, null, null, null);

                assertThatThrownBy(() -> prescriptionService.issue(providerId, req))
                                .isInstanceOf(AppException.class)
                                .hasMessageContaining("not the provider");
        }

        // ── cancel ────────────────────────────────────────────────────────────────

        @Test
        void cancel_shouldSetCancelled_whenOwnPrescription() {
                UUID providerId = UUID.randomUUID();
                Prescription p = buildActivePrescription(providerId);

                when(prescriptionRepository.findById(p.getPrescriptionId()))
                                .thenReturn(Optional.of(p));
                when(prescriptionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

                PrescriptionDto result = prescriptionService.cancel(p.getPrescriptionId(), providerId);
                assertThat(result.status()).isEqualTo("CANCELLED");
        }

        @Test
        void cancel_shouldThrowForbidden_whenNotOwner() {
                UUID providerId = UUID.randomUUID();
                UUID otherId = UUID.randomUUID();
                Prescription p = buildActivePrescription(otherId);

                when(prescriptionRepository.findById(p.getPrescriptionId()))
                                .thenReturn(Optional.of(p));

                assertThatThrownBy(() -> prescriptionService.cancel(p.getPrescriptionId(), providerId))
                                .isInstanceOf(AppException.class)
                                .hasMessageContaining("did not issue");
        }

        @Test
        void cancel_shouldThrow_whenNotCancellable() {
                UUID providerId = UUID.randomUUID();
                Prescription p = buildActivePrescription(providerId);
                p.setStatus(PrescriptionStatus.DELIVERED);

                when(prescriptionRepository.findById(p.getPrescriptionId()))
                                .thenReturn(Optional.of(p));

                assertThatThrownBy(() -> prescriptionService.cancel(p.getPrescriptionId(), providerId))
                                .isInstanceOf(AppException.class)
                                .hasMessageContaining("Only PENDING or PROCESSING");
        }

        // ── getById ownership ─────────────────────────────────────────────────────

        @Test
        void getById_shouldThrowForbidden_forUnrelatedUser() {
                UUID providerId = UUID.randomUUID();
                Prescription p = buildActivePrescription(providerId);

                when(prescriptionRepository.findById(p.getPrescriptionId()))
                                .thenReturn(Optional.of(p));

                assertThatThrownBy(() -> prescriptionService.getById(p.getPrescriptionId(), UUID.randomUUID(),
                                Role.PATIENT))
                                .isInstanceOf(AppException.class)
                                .hasMessageContaining("do not have access");
        }

        // ── Fixtures ──────────────────────────────────────────────────────────────

        private Patient buildPatient(UUID userId) {
                User u = new User();
                u.setUserId(userId);
                u.setName("Alice");
                u.setEmail("a@test.com");
                u.setRole(Role.PATIENT);
                u.setVerified(true);
                Patient p = new Patient();
                p.setUserId(userId);
                p.setUser(u);
                return p;
        }

        private Provider buildProvider(UUID userId) {
                User u = new User();
                u.setUserId(userId);
                u.setName("Dr Test");
                u.setEmail("dr@test.com");
                u.setRole(Role.PROVIDER);
                u.setVerified(true);
                Provider pv = new Provider();
                pv.setUserId(userId);
                pv.setUser(u);
                pv.setActive(true);
                pv.setRating(BigDecimal.valueOf(4.5));
                return pv;
        }

        private HealthRecord buildEhr(Patient patient) {
                HealthRecord r = new HealthRecord();
                r.setPatient(patient);
                r.setMedications("[]");
                return r;
        }

        private Prescription buildActivePrescription(UUID providerId) {
                UUID patientId = UUID.randomUUID();
                Prescription p = new Prescription();
                p.setPrescriptionId(UUID.randomUUID());
                p.setPatient(buildPatient(patientId));
                p.setProvider(buildProvider(providerId));
                p.setMedications("[]");
                p.setStatus(PrescriptionStatus.PENDING);
                return p;
        }

        private Consultation buildConsultation(UUID consultationId,
                        UUID providerId, UUID patientId) {
                rw.shcp.appointments.Appointment appt = new rw.shcp.appointments.Appointment();
                appt.setAppointmentId(UUID.randomUUID());
                appt.setPatient(buildPatient(patientId));
                appt.setProvider(buildProvider(providerId));
                appt.setScheduledAt(OffsetDateTime.now());
                appt.setType(AppointmentType.VIDEO);
                appt.setStatus(AppointmentStatus.COMPLETED);

                Consultation c = new Consultation();
                c.setConsultationId(consultationId);
                c.setAppointment(appt);
                c.setStatus(ConsultationStatus.COMPLETED);
                return c;
        }
}
