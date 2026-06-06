package rw.shcp.users.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.appointments.Availability;
import rw.shcp.appointments.AvailabilityRepository;
import rw.shcp.appointments.AppointmentRepository;
import rw.shcp.common.exception.AppException;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.ehr.HealthRecordRepository;
import rw.shcp.users.dto.*;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;
import rw.shcp.users.repository.UserRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProviderService {

    private final ProviderRepository providerRepository;
    private final UserRepository userRepository;
    private final PatientRepository patientRepository;
    private final AvailabilityRepository availabilityRepository;
    private final AppointmentRepository appointmentRepository;
    private final HealthRecordRepository ehrRepository;

    // ── Public endpoints (no auth required) ──────────────────

    public Page<ProviderSummaryDto> getPublicProviders(Pageable pageable) {
        return providerRepository.findAll(pageable).map(ProviderSummaryDto::from);
    }

    public ProviderProfileDto getPublicProfile(UUID providerId) {
        Provider provider = findProviderOrThrow(providerId);
        return ProviderProfileDto.from(provider);
    }

    public List<AvailabilityDto> getProviderAvailability(UUID providerId, LocalDate date) {
        findProviderOrThrow(providerId); // validate provider exists
        OffsetDateTime from = (date != null)
                ? date.atStartOfDay().atOffset(ZoneOffset.UTC)
                : OffsetDateTime.now();
        OffsetDateTime to = (date != null)
                ? date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC)
                : OffsetDateTime.now().plusYears(10);
        return availabilityRepository
                .findByProviderUserIdAndIsBookedFalseAndStartTimeBetween(providerId, from, to)
                .stream()
                .map(AvailabilityDto::from)
                .toList();
    }

    // ── Provider-own endpoints ────────────────────────────────

    @PreAuthorize("hasRole('PROVIDER')")
    public ProviderProfileDto getMyProfile(UUID userId) {
        return ProviderProfileDto.from(findProviderOrThrow(userId));
    }

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public ProviderProfileDto updateMyProfile(UUID userId, UpdateProviderRequest req) {
        Provider provider = findProviderOrThrow(userId);
        User user = provider.getUser();

        if (req.name() != null)
            user.setName(req.name());
        if (req.phone() != null)
            user.setPhone(req.phone());
        if (req.languagePref() != null)
            user.setLanguagePref(req.languagePref());
        if (req.deviceToken() != null)
            user.setDeviceToken(req.deviceToken());
        if (req.specialty() != null)
            provider.setSpecialty(req.specialty());
        if (req.facility() != null)
            provider.setFacility(req.facility());

        userRepository.save(user);
        providerRepository.save(provider);
        return ProviderProfileDto.from(provider);
    }

    /**
     * Replaces all future non-booked slots with the provided list.
     * Already-booked slots are never touched.
     */
    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public List<AvailabilityDto> setMyAvailability(UUID providerId,
            SetAvailabilityRequest req) {
        Provider provider = findProviderOrThrow(providerId);
        validateSlots(req);

        // Remove existing future non-booked slots
        availabilityRepository.deleteFutureUnbookedByProviderId(providerId, OffsetDateTime.now());

        // Persist new slots
        List<Availability> saved = req.slots().stream().map(s -> {
            Availability slot = new Availability();
            slot.setProvider(provider);
            slot.setStartTime(s.startTime());
            slot.setEndTime(s.endTime());
            slot.setAppointmentType(s.appointmentType());
            return availabilityRepository.save(slot);
        }).toList();

        return saved.stream().map(AvailabilityDto::from).toList();
    }

    /** Appends a single availability slot without touching existing ones. */
    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public AvailabilityDto addSlot(UUID providerId, SetAvailabilityRequest.SlotRequest slot) {
        Provider provider = findProviderOrThrow(providerId);
        if (!slot.endTime().isAfter(slot.startTime())) {
            throw AppException.badRequest("Slot end time must be after start time");
        }
        Availability availability = new Availability();
        availability.setProvider(provider);
        availability.setStartTime(slot.startTime());
        availability.setEndTime(slot.endTime());
        availability.setAppointmentType(slot.appointmentType());
        return AvailabilityDto.from(availabilityRepository.save(availability));
    }

    @PreAuthorize("hasRole('PROVIDER')")
    public Page<AppointmentSummaryDto> getMyAppointments(UUID providerId, Pageable pageable) {
        return appointmentRepository
                .findByProviderUserId(providerId, pageable)
                .map(AppointmentSummaryDto::from);
    }

    @PreAuthorize("hasRole('PROVIDER')")
    public List<PatientSummaryDto> getMyPatients(UUID providerId) {
        findProviderOrThrow(providerId);
        return appointmentRepository
                .findDistinctPatientsByProviderId(providerId)
                .stream()
                .map(PatientSummaryDto::from)
                .toList();
    }

    @PreAuthorize("hasRole('PROVIDER')")
    public List<AvailabilityDto> getMySlots(UUID providerId) {
        findProviderOrThrow(providerId);
        return availabilityRepository.findByProviderUserId(providerId)
                .stream()
                .map(AvailabilityDto::from)
                .toList();
    }

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public AvailabilityDto blockSlot(UUID providerId, UUID slotId) {
        findProviderOrThrow(providerId);
        Availability slot = availabilityRepository.findById(slotId)
                .orElseThrow(() -> AppException.notFound("Slot not found"));
        if (!slot.getProvider().getUserId().equals(providerId))
            throw AppException.forbidden("This slot does not belong to you");
        if (slot.isBooked())
            throw AppException.badRequest("Cannot block a slot that is already booked");
        slot.setBlocked(!slot.isBlocked());
        return AvailabilityDto.from(availabilityRepository.save(slot));
    }

    @PreAuthorize("hasRole('PROVIDER')")
    public String exportIcal(UUID providerId) {
        findProviderOrThrow(providerId);
        List<Availability> slots = availabilityRepository.findByProviderUserId(providerId);
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\n");
        sb.append("VERSION:2.0\r\n");
        sb.append("PRODID:-//SHCP//Provider Availability//EN\r\n");
        sb.append("CALSCALE:GREGORIAN\r\n");
        sb.append("METHOD:PUBLISH\r\n");
        String now = java.time.OffsetDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
        for (Availability s : slots) {
            String dtStart = s.getStartTime().withOffsetSameInstant(java.time.ZoneOffset.UTC)
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
            String dtEnd = s.getEndTime().withOffsetSameInstant(java.time.ZoneOffset.UTC)
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'"));
            String type = s.getAppointmentType() != null ? s.getAppointmentType().name() : "SLOT";
            String status = s.isBlocked() ? "CANCELLED" : (s.isBooked() ? "CONFIRMED" : "TENTATIVE");
            sb.append("BEGIN:VEVENT\r\n");
            sb.append("UID:").append(s.getSlotId()).append("@shcp\r\n");
            sb.append("DTSTAMP:").append(now).append("\r\n");
            sb.append("DTSTART:").append(dtStart).append("\r\n");
            sb.append("DTEND:").append(dtEnd).append("\r\n");
            sb.append("SUMMARY:").append(type).append(" Slot\r\n");
            sb.append("STATUS:").append(status).append("\r\n");
            sb.append("END:VEVENT\r\n");
        }
        sb.append("END:VCALENDAR\r\n");
        return sb.toString();
    }

    @PreAuthorize("hasRole('PROVIDER')")
    public PatientCheckUpSummaryDto getPatientCheckUpSummary(UUID providerId, UUID patientId) {
        findProviderOrThrow(providerId);
        if (!appointmentRepository.existsByProviderUserIdAndPatientUserId(providerId, patientId)) {
            throw AppException.forbidden("You do not have an appointment with this patient");
        }
        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> AppException.notFound("Patient not found"));
        return PatientCheckUpSummaryDto.from(patient);
    }

    @PreAuthorize("hasRole('PROVIDER')")
    public HealthRecordDto getPatientEhr(UUID providerId, UUID patientId) {
        findProviderOrThrow(providerId);
        if (!appointmentRepository.existsByProviderUserIdAndPatientUserId(providerId, patientId)) {
            throw AppException.forbidden("You do not have an appointment with this patient");
        }
        return ehrRepository.findByPatientUserId(patientId)
                .map(HealthRecordDto::from)
                .orElse(HealthRecordDto.empty(patientId));
    }

    // ── Instant availability ──────────────────────────────────

    public List<InstantAvailableProviderDto> getInstantAvailableProviders() {
        return providerRepository.findByIsAvailableForInstantTrueAndIsActiveTrue()
                .stream()
                .map(InstantAvailableProviderDto::from)
                .toList();
    }

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public ProviderProfileDto toggleInstantAvailability(UUID providerId) {
        Provider provider = findProviderOrThrow(providerId);
        provider.setAvailableForInstant(!provider.isAvailableForInstant());
        providerRepository.save(provider);
        return ProviderProfileDto.from(provider);
    }

    // ── Helpers ───────────────────────────────────────────────

    private Provider findProviderOrThrow(UUID userId) {
        return providerRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Provider not found"));
    }

    private void validateSlots(SetAvailabilityRequest req) {
        req.slots().forEach(s -> {
            if (!s.endTime().isAfter(s.startTime())) {
                throw AppException.badRequest(
                        "Slot end time must be after start time. Start: "
                        + s.startTime() + " End: " + s.endTime());
            }
        });
    }
}
