package rw.shcp.consultations;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import rw.shcp.appointments.Appointment;
import rw.shcp.appointments.AppointmentRepository;
import rw.shcp.common.enums.AppointmentStatus;
import rw.shcp.common.enums.AppointmentType;
import rw.shcp.common.enums.ConsultationStatus;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.common.storage.FileStorageService;
import rw.shcp.consultations.dto.*;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class ConsultationService {

    private final ConsultationRepository           consultationRepository;
    private final ConsultationAuditEventRepository auditRepository;
    private final AppointmentRepository            appointmentRepository;
    private final NotificationPublisher            notificationPublisher;
    private final FileStorageService               fileStorageService;
    private final PatientRepository                patientRepository;
    private final ProviderRepository               providerRepository;

    @Value("${coturn.secret:changeme}")
    private String coturnSecret;

    @Value("${coturn.host:localhost}")
    private String coturnHost;

    @Value("${coturn.port:3478}")
    private int coturnPort;

    @Value("${coturn.tls-port:5349}")
    private int coturnTlsPort;

    @Value("${coturn.realm:shcp.rw}")
    private String coturnRealm;

    // ── Start ─────────────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public ConsultationDto start(UUID providerUserId, StartConsultationRequest req) {
        Appointment appointment = appointmentRepository.findById(req.appointmentId())
                .orElseThrow(() -> AppException.notFound("Appointment not found"));

        if (!appointment.getProvider().getUserId().equals(providerUserId)) {
            throw AppException.forbidden("You are not the provider for this appointment");
        }

        if (appointment.getStatus() != AppointmentStatus.CONFIRMED) {
            throw AppException.badRequest(
                    "Only CONFIRMED appointments can be started. Current status: "
                    + appointment.getStatus());
        }

        if (consultationRepository.existsByAppointment_AppointmentIdAndStatusNot(
                req.appointmentId(), ConsultationStatus.CANCELLED)) {
            throw AppException.conflict(
                    "A consultation for this appointment already exists");
        }

        appointment.setStatus(AppointmentStatus.IN_PROGRESS);
        appointmentRepository.save(appointment);

        Consultation consultation = new Consultation();
        consultation.setAppointment(appointment);
        consultation.setRoomId(UUID.randomUUID().toString());
        consultation.setStartedAt(OffsetDateTime.now());
        consultation.setStatus(ConsultationStatus.IN_PROGRESS);

        Consultation saved = consultationRepository.save(consultation);
        log.info("Consultation {} started: appointment={} room={}",
                saved.getConsultationId(), req.appointmentId(), saved.getRoomId());

        writeAuditEvent(saved.getConsultationId(), saved.getRoomId(),
                AuditEventTypes.CALL_STARTED, providerUserId, "PROVIDER", null, null);

        publishConsultationEvent(saved, "consultation.started",
                "Your consultation has started. Join room: " + saved.getRoomId());

        return ConsultationDto.from(saved);
    }

    // ── Instant consult (patient-initiated, no pre-booked slot) ──────────────

    @Transactional
    @PreAuthorize("hasRole('PATIENT')")
    public ConsultationDto startInstant(UUID patientUserId, InstantConsultRequest req) {
        Patient patient = patientRepository.findById(patientUserId)
                .orElseThrow(() -> AppException.notFound("Patient profile not found"));

        Provider provider = providerRepository.findById(req.providerId())
                .orElseThrow(() -> AppException.notFound("Provider not found"));

        if (!provider.isActive()) {
            throw AppException.badRequest("This provider is not currently accepting appointments");
        }

        // Atomically claim the slot — prevents two patients from booking the same provider concurrently
        int claimed = providerRepository.claimInstantSlot(req.providerId());
        if (claimed == 0) {
            throw AppException.badRequest("This provider is not available for instant consultations right now");
        }

        // Re-fetch provider after update so the entity reflects the committed state
        provider = providerRepository.findById(req.providerId())
                .orElseThrow(() -> AppException.notFound("Provider not found"));

        Appointment appointment = new Appointment();
        appointment.setPatient(patient);
        appointment.setProvider(provider);
        appointment.setScheduledAt(OffsetDateTime.now());
        appointment.setType(AppointmentType.INSTANT);
        appointment.setStatus(AppointmentStatus.IN_PROGRESS);
        if (req.notes() != null) appointment.setNotes(req.notes());

        Appointment savedAppointment = appointmentRepository.save(appointment);

        Consultation consultation = new Consultation();
        consultation.setAppointment(savedAppointment);
        consultation.setRoomId(UUID.randomUUID().toString());
        consultation.setStartedAt(OffsetDateTime.now());
        consultation.setStatus(ConsultationStatus.IN_PROGRESS);

        Consultation saved = consultationRepository.save(consultation);
        log.info("Instant consultation {} started: patient={} provider={} room={}",
                saved.getConsultationId(), patientUserId, req.providerId(), saved.getRoomId());

        writeAuditEvent(saved.getConsultationId(), saved.getRoomId(),
                AuditEventTypes.CALL_STARTED, patientUserId, "PATIENT", null,
                "{\"instant\":true}");

        // Notify provider
        Map<String, Object> meta = Map.of(
                "consultationId", saved.getConsultationId().toString(),
                "roomId",         saved.getRoomId(),
                "appointmentId",  savedAppointment.getAppointmentId().toString(),
                "patientName",    patient.getUser().getName()
        );
        notificationPublisher.publish(NotificationEvent.push(
                provider.getUserId(), "instant.consult.request",
                patient.getUser().getName() + " is requesting an instant consultation. Join now.",
                meta));
        notificationPublisher.publish(NotificationEvent.email(
                provider.getUserId(), "instant.consult.request",
                patient.getUser().getName() + " is requesting an instant consultation. Join now.",
                meta));

        return ConsultationDto.from(saved);
    }

    // ── Get incoming instant consult for provider ─────────────────────────────

    @PreAuthorize("hasRole('PROVIDER')")
    public ConsultationDto getIncomingInstant(UUID providerUserId) {
        return consultationRepository.findIncomingInstantByProviderId(providerUserId)
                .stream()
                .findFirst()
                .map(ConsultationDto::from)
                .orElse(null);
    }

    // ── End ───────────────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public ConsultationDto end(UUID consultationId, UUID providerUserId,
                               EndConsultationRequest req) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        if (!consultation.getAppointment().getProvider().getUserId().equals(providerUserId)) {
            throw AppException.forbidden("You are not the provider for this consultation");
        }

        if (consultation.getStatus() != ConsultationStatus.IN_PROGRESS) {
            throw AppException.badRequest(
                    "Only IN_PROGRESS consultations can be ended. Current: "
                    + consultation.getStatus());
        }

        OffsetDateTime now = OffsetDateTime.now();
        long minutes = Duration.between(consultation.getStartedAt(), now).toMinutes();

        consultation.setEndedAt(now);
        consultation.setDurationMinutes((int) minutes);
        consultation.setStatus(ConsultationStatus.COMPLETED);
        consultation.setNotes(req.notes());
        if (req.recordingUrl() != null) {
            consultation.setRecordingUrl(req.recordingUrl());
        }

        Appointment appointment = consultation.getAppointment();
        appointment.setStatus(AppointmentStatus.COMPLETED);
        appointmentRepository.save(appointment);

        Consultation saved = consultationRepository.save(consultation);
        log.info("Consultation {} ended: duration={}min", consultationId, minutes);

        writeAuditEvent(consultationId, saved.getRoomId(),
                AuditEventTypes.CALL_ENDED, providerUserId, "PROVIDER",
                null, "{\"durationMinutes\":" + minutes + "}");

        publishConsultationEvent(saved, "consultation.completed",
                "Your consultation has ended. Duration: " + minutes + " minutes.");

        return ConsultationDto.from(saved);
    }

    // ── Get by ID ─────────────────────────────────────────────────────────────

    public ConsultationDto getById(UUID consultationId, UUID currentUserId, Role currentRole) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        assertAccess(consultation, currentUserId, currentRole);
        return ConsultationDto.from(consultation);
    }

    // ── Get by Appointment ────────────────────────────────────────────────────

    public ConsultationDto getByAppointment(UUID appointmentId,
                                             UUID currentUserId, Role currentRole) {
        Consultation consultation = consultationRepository
                .findByAppointment_AppointmentId(appointmentId)
                .orElseThrow(() -> AppException.notFound(
                        "No consultation found for this appointment"));

        assertAccess(consultation, currentUserId, currentRole);
        return ConsultationDto.from(consultation);
    }

    // ── My consultations ──────────────────────────────────────────────────────

    public List<ConsultationDto> getMyConsultations(UUID userId, Role role) {
        List<Consultation> list = (role == Role.PATIENT)
                ? consultationRepository.findByAppointment_Patient_UserIdOrderByCreatedAtDesc(userId)
                : consultationRepository.findByAppointment_Provider_UserIdOrderByCreatedAtDesc(userId);

        return list.stream().map(ConsultationDto::from).toList();
    }

    // ── Audit log (client-submitted events) ───────────────────────────────────

    @Transactional
    public void logClientAuditEvent(UUID consultationId, UUID userId, Role role,
                                    LogAuditRequest req, String ipAddress) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        assertAccess(consultation, userId, role);

        if (!AuditEventTypes.CLIENT_ALLOWED.contains(req.eventType())) {
            throw AppException.badRequest("Event type not allowed: " + req.eventType());
        }

        writeAuditEvent(consultationId, consultation.getRoomId(),
                req.eventType(), userId, role.name(), ipAddress, req.metadata());
    }

    // ── Audit log (read) ──────────────────────────────────────────────────────

    public List<AuditEventDto> getAuditLog(UUID consultationId, UUID userId, Role role) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        // Only provider or admin can view full audit log
        if (role != Role.PROVIDER && role != Role.ADMIN) {
            throw AppException.forbidden("Only providers and admins can view audit logs");
        }
        if (role == Role.PROVIDER &&
                !consultation.getAppointment().getProvider().getUserId().equals(userId)) {
            throw AppException.forbidden("You are not the provider for this consultation");
        }

        return auditRepository.findByConsultationIdOrderByCreatedAtAsc(consultationId)
                .stream().map(AuditEventDto::from).toList();
    }

    // ── Recording consent ─────────────────────────────────────────────────────

    @Transactional
    public ConsultationDto grantRecordingConsent(UUID consultationId, UUID patientUserId) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        if (!consultation.getAppointment().getPatient().getUserId().equals(patientUserId)) {
            throw AppException.forbidden("Only the patient may grant recording consent");
        }

        if (consultation.getStatus() != ConsultationStatus.IN_PROGRESS) {
            throw AppException.badRequest("Consent can only be granted during an active consultation");
        }

        consultation.setRecordingConsentAt(OffsetDateTime.now());
        consultation.setRecordingConsentById(patientUserId);
        Consultation saved = consultationRepository.save(consultation);

        writeAuditEvent(consultationId, saved.getRoomId(),
                AuditEventTypes.RECORDING_CONSENT_GIVEN, patientUserId, "PATIENT", null, null);

        return ConsultationDto.from(saved);
    }

    // ── Recording upload ──────────────────────────────────────────────────────

    @Transactional
    public ConsultationDto uploadRecording(UUID consultationId, UUID userId,
                                           Role role, MultipartFile file) throws IOException {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        assertAccess(consultation, userId, role);

        if (consultation.getStatus() == ConsultationStatus.CANCELLED) {
            throw AppException.badRequest("Cannot upload recording for a cancelled consultation");
        }

        // Store under a subfolder keyed to the consultationId so files are easy to find
        String storedName = fileStorageService.storeRecording(file, consultationId);
        consultation.setRecordingUrl("recordings/" + consultationId + "/" + storedName);
        Consultation saved = consultationRepository.save(consultation);

        writeAuditEvent(consultationId, saved.getRoomId(),
                AuditEventTypes.RECORDING_STOPPED, userId, role.name(), null,
                "{\"storedName\":\"" + storedName + "\"}");

        log.info("Recording uploaded for consultation {}: {}", consultationId, storedName);
        return ConsultationDto.from(saved);
    }

    // ── Recording download ────────────────────────────────────────────────────

    public org.springframework.core.io.Resource getRecording(UUID consultationId, UUID userId, Role role) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        assertAccess(consultation, userId, role);

        String recordingUrl = consultation.getRecordingUrl();
        if (recordingUrl == null || recordingUrl.isBlank()) {
            throw AppException.notFound("No recording available for this consultation");
        }

        // recordingUrl is stored as "recordings/{consultationId}/{storedName}"
        String storedName = recordingUrl.substring(recordingUrl.lastIndexOf('/') + 1);
        return fileStorageService.loadRecording(consultationId, storedName);
    }

    // ── TURN credentials ──────────────────────────────────────────────────────

    public TurnCredentialsDto getTurnCredentials(UUID consultationId, UUID userId, Role role) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        assertAccess(consultation, userId, role);

        // Time-limited credentials: expire 4 hours from now.
        // Format: "<unix_expiry>:<userId>"
        // Credential: Base64(HMAC-SHA1(coturnSecret, username))
        long expiry = Instant.now().getEpochSecond() + (4 * 3600);
        String username = expiry + ":" + userId.toString();
        String credential = computeHmacSha1(coturnSecret, username);

        List<TurnCredentialsDto.IceServer> servers = List.of(
                // STUN — no credentials needed
                new TurnCredentialsDto.IceServer(
                        List.of("stun:" + coturnHost + ":3478"), null, null),
                // TURN UDP
                new TurnCredentialsDto.IceServer(
                        List.of("turn:" + coturnHost + ":" + coturnPort),
                        username, credential),
                // TURN TCP
                new TurnCredentialsDto.IceServer(
                        List.of("turn:" + coturnHost + ":" + coturnPort + "?transport=tcp"),
                        username, credential),
                // TURNS TLS
                new TurnCredentialsDto.IceServer(
                        List.of("turns:" + coturnHost + ":" + coturnTlsPort + "?transport=tcp"),
                        username, credential)
        );

        return new TurnCredentialsDto(servers);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void assertAccess(Consultation c, UUID userId, Role role) {
        boolean isPatient  = role == Role.PATIENT  &&
                c.getAppointment().getPatient().getUserId().equals(userId);
        boolean isProvider = role == Role.PROVIDER &&
                c.getAppointment().getProvider().getUserId().equals(userId);
        boolean isAdmin    = role == Role.ADMIN;

        if (!isPatient && !isProvider && !isAdmin) {
            throw AppException.forbidden("You do not have access to this consultation");
        }
    }

    @Transactional
    void writeAuditEvent(UUID consultationId, String roomId,
                         String eventType, UUID participantId,
                         String participantRole, String ipAddress, String metadata) {
        ConsultationAuditEvent event = new ConsultationAuditEvent();
        event.setConsultationId(consultationId);
        event.setRoomId(roomId);
        event.setEventType(eventType);
        event.setParticipantId(participantId);
        event.setParticipantRole(participantRole);
        event.setIpAddress(ipAddress);
        event.setMetadata(metadata);
        auditRepository.save(event);
    }

    private void publishConsultationEvent(Consultation c, String eventType, String message) {
        UUID patientId  = c.getAppointment().getPatient().getUserId();
        UUID providerId = c.getAppointment().getProvider().getUserId();

        Map<String, Object> meta = Map.of(
                "consultationId", c.getConsultationId().toString(),
                "roomId",         c.getRoomId() != null ? c.getRoomId() : "",
                "appointmentId",  c.getAppointment().getAppointmentId().toString()
        );

        notificationPublisher.publish(
                NotificationEvent.email(patientId,  eventType, message, meta));
        notificationPublisher.publish(
                NotificationEvent.push(patientId,   eventType, message, meta));
        notificationPublisher.publish(
                NotificationEvent.push(providerId,  eventType, message, meta));
    }

    private static String computeHmacSha1(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            return Base64.getEncoder().encodeToString(
                    mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA1 computation failed", e);
        }
    }
}
