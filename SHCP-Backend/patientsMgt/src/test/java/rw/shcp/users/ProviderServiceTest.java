package rw.shcp.users;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import rw.shcp.appointments.Availability;
import rw.shcp.appointments.AvailabilityRepository;
import rw.shcp.appointments.AppointmentRepository;
import rw.shcp.common.enums.AppointmentType;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.users.dto.*;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.ProviderRepository;
import rw.shcp.users.repository.UserRepository;
import rw.shcp.users.service.ProviderService;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProviderServiceTest {

    @Mock
    ProviderRepository providerRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    AvailabilityRepository availabilityRepository;
    @Mock
    AppointmentRepository appointmentRepository;

    @InjectMocks
    ProviderService providerService;

    // ── getPublicProviders ────────────────────────────────────

    @Test
    void getPublicProviders_shouldReturnPage() {
        Provider p = buildProvider(UUID.randomUUID());
        when(providerRepository.findAll(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(p)));

        Page<ProviderSummaryDto> result = providerService.getPublicProviders(PageRequest.of(0, 20));

        assertThat(result.getTotalElements()).isEqualTo(1);
        assertThat(result.getContent().get(0).specialty()).isEqualTo("General Medicine");
    }

    // ── getPublicProfile ──────────────────────────────────────

    @Test
    void getPublicProfile_shouldReturnProfile_whenProviderExists() {
        UUID id = UUID.randomUUID();
        Provider p = buildProvider(id);
        when(providerRepository.findById(id)).thenReturn(Optional.of(p));

        ProviderProfileDto dto = providerService.getPublicProfile(id);

        assertThat(dto.userId()).isEqualTo(id);
        assertThat(dto.specialty()).isEqualTo("General Medicine");
    }

    @Test
    void getPublicProfile_shouldThrowNotFound_whenMissing() {
        UUID id = UUID.randomUUID();
        when(providerRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> providerService.getPublicProfile(id))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("not found");
    }

    // ── getProviderAvailability ───────────────────────────────

    @Test
    void getProviderAvailability_shouldReturnOnlyFutureUnbookedSlots() {
        UUID id = UUID.randomUUID();
        Provider p = buildProvider(id);
        Availability slot = buildSlot(p, false);

        when(providerRepository.findById(id)).thenReturn(Optional.of(p));
        when(availabilityRepository
                .findByProviderUserIdAndIsBookedFalseAndStartTimeBetween(eq(id), any(), any()))
                .thenReturn(List.of(slot));

        List<AvailabilityDto> result = providerService.getProviderAvailability(id, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).isBooked()).isFalse();
    }

    // ── setMyAvailability ─────────────────────────────────────

    @Test
    void setMyAvailability_shouldDeleteFutureSlotsAndPersistNew() {
        UUID id = UUID.randomUUID();
        Provider p = buildProvider(id);
        when(providerRepository.findById(id)).thenReturn(Optional.of(p));

        OffsetDateTime start = OffsetDateTime.now().plusDays(1);
        OffsetDateTime end = start.plusHours(1);
        SetAvailabilityRequest req = new SetAvailabilityRequest(
                List.of(new SetAvailabilityRequest.SlotRequest(start, end, AppointmentType.VIDEO)));

        Availability saved = buildSlot(p, false);
        saved.setStartTime(start);
        saved.setEndTime(end);
        when(availabilityRepository.save(any())).thenReturn(saved);

        List<AvailabilityDto> result = providerService.setMyAvailability(id, req);

        verify(availabilityRepository).deleteFutureUnbookedByProviderId(eq(id), any());
        assertThat(result).hasSize(1);
    }

    @Test
    void setMyAvailability_shouldThrowBadRequest_whenEndBeforeStart() {
        UUID id = UUID.randomUUID();
        Provider p = buildProvider(id);
        when(providerRepository.findById(id)).thenReturn(Optional.of(p));

        OffsetDateTime start = OffsetDateTime.now().plusDays(1);
        OffsetDateTime end = start.minusHours(1); // invalid
        SetAvailabilityRequest req = new SetAvailabilityRequest(
                List.of(new SetAvailabilityRequest.SlotRequest(start, end, null)));

        assertThatThrownBy(() -> providerService.setMyAvailability(id, req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("end time must be after");
    }

    // ── getMyPatients ─────────────────────────────────────────

    @Test
    void getMyPatients_shouldReturnDistinctPatients() {
        UUID id = UUID.randomUUID();
        Provider p = buildProvider(id);
        Patient patient = buildPatient();
        when(providerRepository.findById(id)).thenReturn(Optional.of(p));
        when(appointmentRepository.findDistinctPatientsByProviderId(id))
                .thenReturn(List.of(patient));

        List<PatientSummaryDto> result = providerService.getMyPatients(id);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).name()).isEqualTo("Alice Uwase");
    }

    // ── Fixtures ──────────────────────────────────────────────

    private Provider buildProvider(UUID userId) {
        User user = new User();
        user.setUserId(userId);
        user.setName("Dr. Kalisa Jean");
        user.setEmail("kalisa@test.com");
        user.setPhone("+250788000001");
        user.setRole(Role.PROVIDER);
        user.setVerified(true);
        user.setLanguagePref("rw");

        Provider provider = new Provider();
        provider.setUserId(userId);
        provider.setUser(user);
        provider.setLicenseNumber("RW-MED-001");
        provider.setSpecialty("General Medicine");
        provider.setFacility("CHUK");
        provider.setRating(BigDecimal.valueOf(4.5));
        provider.setActive(true);
        return provider;
    }

    private Patient buildPatient() {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        u.setName("Alice Uwase");
        u.setEmail("alice@test.com");
        u.setPhone("+250780000001");
        u.setRole(Role.PATIENT);
        Patient patient = new Patient();
        patient.setUserId(u.getUserId());
        patient.setUser(u);
        patient.setNationalId("1199780000000001");
        return patient;
    }

    private Availability buildSlot(Provider provider, boolean booked) {
        Availability slot = new Availability();
        slot.setSlotId(UUID.randomUUID());
        slot.setProvider(provider);
        slot.setStartTime(OffsetDateTime.now().plusDays(1));
        slot.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
        slot.setBooked(booked);
        slot.setAppointmentType(AppointmentType.VIDEO);
        return slot;
    }
}
