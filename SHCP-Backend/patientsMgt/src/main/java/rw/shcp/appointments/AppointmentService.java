package rw.shcp.appointments;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.appointments.dto.*;
import rw.shcp.common.enums.AppointmentStatus;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.symptoms.SymptomReportRepository;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final AvailabilityRepository availabilityRepository;
    private final PatientRepository patientRepository;
    private final ProviderRepository providerRepository;
    private final NotificationPublisher notificationPublisher;
    private final WaitlistService waitlistService;
    private final SymptomReportRepository symptomReportRepository;

    // ── Book ──────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PATIENT')")
    public AppointmentDto book(UUID patientUserId, BookingRequest req) {
        Patient patient = patientRepository.findById(patientUserId)
                .orElseThrow(() -> AppException.notFound("Patient profile not found"));

        if (!symptomReportRepository.existsByPatientUserId(patientUserId)) {
            throw AppException.badRequest(
                    "You must complete the AI symptom checker before booking an appointment");
        }

        Provider provider = providerRepository.findById(req.providerId())
                .orElseThrow(() -> AppException.notFound("Provider not found"));

        if (!provider.isActive()) {
            throw AppException.badRequest("This provider is not currently accepting appointments");
        }

        // Resolve scheduledAt and optional slot
        Availability slot = null;
        OffsetDateTime scheduledAt;

        if (req.slotId() != null) {
            slot = availabilityRepository.findById(req.slotId())
                    .orElseThrow(() -> AppException.notFound("Availability slot not found"));

            if (slot.isBooked()) {
                throw AppException.conflict("This slot has already been booked");
            }
            if (!slot.getProvider().getUserId().equals(req.providerId())) {
                throw AppException.badRequest("Slot does not belong to the specified provider");
            }
            scheduledAt = slot.getStartTime();
        } else {
            if (req.scheduledAt() == null) {
                throw AppException.badRequest(
                        "Either slotId or scheduledAt must be provided");
            }
            scheduledAt = req.scheduledAt();
        }

        // Double-booking guard
        if (appointmentRepository.existsByProviderUserIdAndScheduledAt(
                req.providerId(), scheduledAt)) {
            throw AppException.conflict(
                    "The provider already has an appointment at this time. " +
                            "Please choose a different slot.");
        }

        Appointment appointment = new Appointment();
        appointment.setPatient(patient);
        appointment.setProvider(provider);
        appointment.setSlot(slot);
        appointment.setScheduledAt(scheduledAt);
        appointment.setType(req.type());
        appointment.setStatus(AppointmentStatus.CONFIRMED);
        appointment.setFee(req.fee());
        appointment.setNotes(req.notes());

        if (slot != null) {
            slot.setBooked(true);
            availabilityRepository.save(slot);
        }

        Appointment saved = appointmentRepository.save(appointment);
        log.info("Appointment {} booked: patient={} provider={} at={}",
                saved.getAppointmentId(), patientUserId, req.providerId(), scheduledAt);

        publishConfirmationEvents(saved);
        return AppointmentDto.from(saved);
    }

    // ── Get by ID ─────────────────────────────────────────────

    public AppointmentDto getById(UUID appointmentId, UUID currentUserId, Role currentRole) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> AppException.notFound("Appointment not found"));

        assertOwnership(appointment, currentUserId, currentRole);
        return AppointmentDto.from(appointment);
    }

    // ── Cancel ────────────────────────────────────────────────

    @Transactional
    public AppointmentDto cancel(UUID appointmentId, UUID currentUserId,
            Role currentRole, CancelRequest req) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> AppException.notFound("Appointment not found"));

        assertOwnership(appointment, currentUserId, currentRole);

        if (appointment.getStatus() == AppointmentStatus.CANCELLED) {
            throw AppException.badRequest("Appointment is already cancelled");
        }
        if (appointment.getStatus() == AppointmentStatus.COMPLETED) {
            throw AppException.badRequest("A completed appointment cannot be cancelled");
        }

        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointment.setCancellationReason(req.reason());

        // Release the slot
        if (appointment.getSlot() != null) {
            appointment.getSlot().setBooked(false);
            availabilityRepository.save(appointment.getSlot());
        }

        AppointmentDto result = AppointmentDto.from(appointmentRepository.save(appointment));

        // Notify waitlisted patients that a slot opened up
        LocalDate apptDate = appointment.getScheduledAt()
                .atZoneSameInstant(ZoneId.of("Africa/Kigali")).toLocalDate();
        waitlistService.notifyWaitlist(appointment.getProvider().getUserId(), apptDate);

        return result;
    }

    // ── Reschedule ────────────────────────────────────────────

    @Transactional
    public AppointmentDto reschedule(UUID appointmentId, UUID currentUserId,
            Role currentRole, RescheduleRequest req) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> AppException.notFound("Appointment not found"));

        assertOwnership(appointment, currentUserId, currentRole);

        AppointmentStatus status = appointment.getStatus();
        if (status != AppointmentStatus.PENDING && status != AppointmentStatus.CONFIRMED) {
            throw AppException.badRequest(
                    "Only PENDING or CONFIRMED appointments can be rescheduled");
        }

        // Release old slot
        if (appointment.getSlot() != null) {
            appointment.getSlot().setBooked(false);
            availabilityRepository.save(appointment.getSlot());
            appointment.setSlot(null);
        }

        // Resolve new time
        OffsetDateTime newTime;
        Availability newSlot = null;

        if (req.newSlotId() != null) {
            newSlot = availabilityRepository.findById(req.newSlotId())
                    .orElseThrow(() -> AppException.notFound("New availability slot not found"));
            if (newSlot.isBooked()) {
                throw AppException.conflict("The requested slot is already booked");
            }
            newTime = newSlot.getStartTime();
        } else {
            if (req.newScheduledAt() == null) {
                throw AppException.badRequest(
                        "Either newSlotId or newScheduledAt must be provided");
            }
            newTime = req.newScheduledAt();
        }

        // Double-booking guard for new time
        if (appointmentRepository.existsByProviderUserIdAndScheduledAt(
                appointment.getProvider().getUserId(), newTime)) {
            throw AppException.conflict(
                    "The provider already has an appointment at the new time");
        }

        appointment.setScheduledAt(newTime);
        appointment.setSlot(newSlot);

        if (newSlot != null) {
            newSlot.setBooked(true);
            availabilityRepository.save(newSlot);
        }

        return AppointmentDto.from(appointmentRepository.save(appointment));
    }

    // ── Available slot search ─────────────────────────────────

    public List<AvailableSlotDto> searchAvailable(String specialty, LocalDate date,
            String language, String type) {
        OffsetDateTime from;
        OffsetDateTime to;

        if (date != null) {
            from = date.atStartOfDay().atOffset(ZoneOffset.UTC);
            to = from.plusDays(1);
        } else {
            from = OffsetDateTime.now();
            to = from.plusYears(1); // search up to 1 year ahead
        }

        return availabilityRepository
                .searchAvailableSlots(from, to, specialty, language, type)
                .stream()
                .map(AvailableSlotDto::from)
                .toList();
    }

    // ── Private helpers ───────────────────────────────────────

    private void assertOwnership(Appointment appointment, UUID userId, Role role) {
        boolean isPatient = role == Role.PATIENT &&
                appointment.getPatient().getUserId().equals(userId);
        boolean isProvider = role == Role.PROVIDER &&
                appointment.getProvider().getUserId().equals(userId);
        boolean isAdmin = role == Role.ADMIN;

        if (!isPatient && !isProvider && !isAdmin) {
            throw AppException.forbidden(
                    "You do not have access to this appointment");
        }
    }

    private static final ZoneId KIGALI = ZoneId.of("Africa/Kigali");
    private static final DateTimeFormatter DISPLAY_FMT =
            DateTimeFormatter.ofPattern("EEEE, MMMM d yyyy 'at' HH:mm").withZone(KIGALI);

    private void publishConfirmationEvents(Appointment appointment) {
        // getUserId() is the shared PK via @MapsId — no extra DB round-trip needed
        UUID patientId  = appointment.getPatient().getUserId();
        UUID providerId = appointment.getProvider().getUserId();
        String patientName  = appointment.getPatient().getUser().getName();
        String providerName = appointment.getProvider().getUser().getName();
        String timeStr = DISPLAY_FMT.format(appointment.getScheduledAt()) + " (Kigali time)";

        Map<String, Object> meta = Map.of(
                "appointmentId", appointment.getAppointmentId().toString(),
                "scheduledAt", timeStr,
                "scheduledAtUtc", appointment.getScheduledAt().toString(),
                "type", appointment.getType().name());

        String patientMsg = "Your appointment with " + providerName +
                " is confirmed for " + timeStr;
        String providerMsg = "New appointment with patient " + patientName +
                " scheduled for " + timeStr;

        notificationPublisher.publish(
                NotificationEvent.email(patientId, "appointment.confirmed", patientMsg, meta));
        notificationPublisher.publish(
                NotificationEvent.push(patientId, "appointment.confirmed", patientMsg, meta));
        notificationPublisher.publish(
                NotificationEvent.email(providerId, "appointment.confirmed", providerMsg, meta));
    }
}
