package rw.shcp.users;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import rw.shcp.appointments.Appointment;
import rw.shcp.appointments.AppointmentRepository;
import rw.shcp.common.enums.AppointmentStatus;
import rw.shcp.common.enums.AppointmentType;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.ehr.HealthRecordRepository;
import rw.shcp.symptoms.SymptomReportRepository;
import rw.shcp.users.dto.*;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.UserRepository;
import rw.shcp.users.service.PatientService;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PatientServiceTest {

    @Mock
    PatientRepository patientRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    HealthRecordRepository ehrRepository;
    @Mock
    SymptomReportRepository symptomRepository;
    @Mock
    AppointmentRepository appointmentRepository;

    @InjectMocks
    PatientService patientService;

    // ── getMyProfile ──────────────────────────────────────────

    @Test
    void getMyProfile_shouldReturnProfile_whenPatientExists() {
        UUID userId = UUID.randomUUID();
        Patient patient = buildPatient(userId);
        when(patientRepository.findById(userId)).thenReturn(Optional.of(patient));

        PatientProfileDto dto = patientService.getMyProfile(userId);

        assertThat(dto.userId()).isEqualTo(userId);
        assertThat(dto.email()).isEqualTo("patient@test.com");
        assertThat(dto.nationalId()).isEqualTo("1199780000000001");
    }

    @Test
    void getMyProfile_shouldThrowNotFound_whenPatientAbsent() {
        UUID userId = UUID.randomUUID();
        when(patientRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> patientService.getMyProfile(userId))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("not found");
    }

    // ── updateMyProfile ───────────────────────────────────────

    @Test
    void updateMyProfile_shouldUpdateUserAndPatientFields() {
        UUID userId = UUID.randomUUID();
        Patient patient = buildPatient(userId);
        when(patientRepository.findById(userId)).thenReturn(Optional.of(patient));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(patientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdatePatientRequest req = new UpdatePatientRequest(
                "New Name", "+250780000099", "en", null, "O+", "INS-999",
                null, null, null, null, null, null);

        PatientProfileDto dto = patientService.updateMyProfile(userId, req);

        assertThat(dto.name()).isEqualTo("New Name");
        assertThat(dto.bloodType()).isEqualTo("O+");
        assertThat(dto.languagePref()).isEqualTo("en");
    }

    @Test
    void updateMyProfile_shouldIgnoreNullFields_andKeepExisting() {
        UUID userId = UUID.randomUUID();
        Patient patient = buildPatient(userId);
        when(patientRepository.findById(userId)).thenReturn(Optional.of(patient));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(patientRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Only update phone; everything else null
        UpdatePatientRequest req = new UpdatePatientRequest(
                null, "+250780000099", null, null, null, null,
                null, null, null, null, null, null);

        PatientProfileDto dto = patientService.updateMyProfile(userId, req);

        // Name stays the same
        assertThat(dto.name()).isEqualTo("Alice Uwase");
        assertThat(dto.phone()).isEqualTo("+250780000099");
    }

    // ── getMyEhr ──────────────────────────────────────────────

    @Test
    void getMyEhr_shouldReturnExistingRecord() {
        UUID userId = UUID.randomUUID();
        Patient patient = buildPatient(userId);
        HealthRecord ehr = new HealthRecord();
        ehr.setPatient(patient);

        when(patientRepository.findById(userId)).thenReturn(Optional.of(patient));
        when(ehrRepository.findByPatientUserId(userId)).thenReturn(Optional.of(ehr));

        HealthRecordDto dto = patientService.getMyEhr(userId);

        assertThat(dto).isNotNull();
        verify(ehrRepository, never()).save(any());
    }

    @Test
    void getMyEhr_shouldCreateEmptyRecord_whenNoneExists() {
        UUID userId = UUID.randomUUID();
        Patient patient = buildPatient(userId);
        HealthRecord newEhr = new HealthRecord();
        newEhr.setPatient(patient);

        when(patientRepository.findById(userId)).thenReturn(Optional.of(patient));
        when(ehrRepository.findByPatientUserId(userId)).thenReturn(Optional.empty());
        when(ehrRepository.save(any())).thenReturn(newEhr);

        HealthRecordDto dto = patientService.getMyEhr(userId);

        assertThat(dto).isNotNull();
        verify(ehrRepository).save(any(HealthRecord.class));
    }

    // ── getMyAppointments ─────────────────────────────────────

    @Test
    void getMyAppointments_shouldReturnPagedResults() {
        UUID userId = UUID.randomUUID();
        Patient patient = buildPatient(userId);
        Appointment appt = buildAppointment(patient);

        Page<Appointment> page = new PageImpl<>(List.of(appt));
        when(appointmentRepository.findByPatientUserId(eq(userId), any()))
                .thenReturn(page);

        Page<AppointmentSummaryDto> result = patientService.getMyAppointments(userId, PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().get(0).patientId()).isEqualTo(userId);
    }

    // ── Fixtures ──────────────────────────────────────────────

    private Patient buildPatient(UUID userId) {
        User user = new User();
        user.setUserId(userId);
        user.setName("Alice Uwase");
        user.setEmail("patient@test.com");
        user.setPhone("+250780000001");
        user.setRole(Role.PATIENT);
        user.setVerified(true);
        user.setLanguagePref("rw");

        Patient patient = new Patient();
        patient.setUserId(userId);
        patient.setUser(user);
        patient.setDateOfBirth(LocalDate.of(1995, 6, 15));
        patient.setNationalId("1199780000000001");
        patient.setBloodType("B+");
        return patient;
    }

    private Appointment buildAppointment(Patient patient) {
        Provider provider = new Provider();
        User provUser = new User();
        provUser.setUserId(UUID.randomUUID());
        provUser.setName("Dr. Kalisa");
        provUser.setRole(Role.PROVIDER);
        provider.setUser(provUser);
        provider.setUserId(provUser.getUserId());

        Appointment a = new Appointment();
        a.setAppointmentId(UUID.randomUUID());
        a.setPatient(patient);
        a.setProvider(provider);
        a.setScheduledAt(OffsetDateTime.now().plusDays(1));
        a.setType(AppointmentType.VIDEO);
        a.setStatus(AppointmentStatus.CONFIRMED);
        return a;
    }
}
