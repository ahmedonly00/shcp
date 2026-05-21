package rw.shcp.prescriptions;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.enums.PrescriptionStatus;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.consultations.Consultation;
import rw.shcp.consultations.ConsultationRepository;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.ehr.HealthRecordRepository;
import rw.shcp.common.util.RwandaLocations;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.pharmacy.Pharmacy;
import rw.shcp.pharmacy.PharmacyService;
import rw.shcp.prescriptions.dto.IssuePrescriptionRequest;
import rw.shcp.prescriptions.dto.MedicationItem;
import rw.shcp.prescriptions.dto.PrescriptionDto;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class PrescriptionService {

    private final PrescriptionRepository  prescriptionRepository;
    private final ConsultationRepository  consultationRepository;
    private final PatientRepository       patientRepository;
    private final ProviderRepository      providerRepository;
    private final HealthRecordRepository  healthRecordRepository;
    private final PharmacyService         pharmacyService;
    private final NotificationPublisher   notificationPublisher;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper            objectMapper;

    // ── Issue ─────────────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public PrescriptionDto issue(UUID providerUserId, IssuePrescriptionRequest req) {
        if (req.medications() == null || req.medications().isEmpty()) {
            throw AppException.badRequest("A prescription must include at least one medication");
        }

        Provider provider = providerRepository.findById(providerUserId)
                .orElseThrow(() -> AppException.notFound("Provider not found"));

        Patient patient = patientRepository.findById(req.patientId())
                .orElseThrow(() -> AppException.notFound("Patient not found"));

        Consultation consultation = null;
        if (req.consultationId() != null) {
            consultation = consultationRepository.findById(req.consultationId())
                    .orElseThrow(() -> AppException.notFound("Consultation not found"));

            // Verify the provider owns this consultation
            if (!consultation.getAppointment().getProvider().getUserId().equals(providerUserId)) {
                throw AppException.forbidden(
                        "You are not the provider for this consultation");
            }
            // Verify the patient matches
            if (!consultation.getAppointment().getPatient().getUserId()
                    .equals(req.patientId())) {
                throw AppException.badRequest(
                        "Patient does not match the consultation");
            }
        }

        // FR6: Allergy alert — warn if any prescribed medication name matches a known allergy
        checkAllergyConflicts(patient, req.medications());

        // FR6: Drug-drug interaction check
        checkDrugInteractions(req.medications());

        String medicationsJson = serializeMedications(req.medications());

        Prescription prescription = new Prescription();
        prescription.setPatient(patient);
        prescription.setProvider(provider);
        prescription.setConsultation(consultation);
        prescription.setMedications(medicationsJson);
        prescription.setInstructions(req.instructions());
        prescription.setProviderSignature(req.providerSignature());
        prescription.setDeliveryAddress(req.deliveryAddress());
        prescription.setDeliveryDistrict(req.deliveryDistrict());
        prescription.setDeliverySector(req.deliverySector());
        prescription.setDeliveryCell(req.deliveryCell());
        prescription.setDeliveryLatitude(req.deliveryLatitude());
        prescription.setDeliveryLongitude(req.deliveryLongitude());
        prescription.setValidUntil(LocalDate.now().plusDays(req.validForDays()));
        prescription.setStatus(PrescriptionStatus.PENDING);

        // ── Gap #10: Rwanda district validation ───────────────────────────────
        if (req.deliveryDistrict() != null && !req.deliveryDistrict().isBlank()
                && !RwandaLocations.isKnownDistrict(req.deliveryDistrict())) {
            log.warn("Unknown Rwanda district '{}' supplied by provider={} — pharmacy cascade may fall back to national",
                    req.deliveryDistrict(), providerUserId);
        }

        // ── Gap #1: extract medication names for stock-aware pharmacy selection ─
        List<String> medNames = req.medications().stream()
                .map(m -> m.name().toLowerCase())
                .toList();

        // Auto-assign nearest pharmacy: cell → sector → district → any active
        // Stock check and Haversine GPS tiebreaker applied at each level.
        try {
            Pharmacy nearest = pharmacyService.resolveNearest(
                    req.deliveryDistrict(), req.deliverySector(), req.deliveryCell(),
                    req.deliveryLatitude(), req.deliveryLongitude(), medNames);
            prescription.setPharmacy(nearest);
            log.info("Prescription auto-assigned to pharmacy={} [{}/{}/{}]",
                    nearest.getPharmacyId(), nearest.getDistrict(),
                    nearest.getSector(), nearest.getCell());
        } catch (AppException e) {
            log.warn("No pharmacy available for prescription — provider={} patient={}: {}",
                    providerUserId, req.patientId(), e.getMessage());
        }

        Prescription saved = prescriptionRepository.save(prescription);
        log.info("Prescription {} issued: patient={} provider={} medications={} pharmacy={}",
                saved.getPrescriptionId(), req.patientId(), providerUserId,
                req.medications().size(),
                saved.getPharmacy() != null ? saved.getPharmacy().getPharmacyId() : "none");

        // Rebuild patient EHR medications from all active prescriptions (deduplicates)
        rebuildEhrMedications(patient);

        // Publish event — notifications fire AFTER_COMMIT so a DB rollback never triggers
        // phantom alerts. PrescriptionEventListener handles patient + pharmacist + no-pharmacy paths.
        eventPublisher.publishEvent(PrescriptionIssuedEvent.from(saved));

        return PrescriptionDto.from(saved);
    }

    // ── Get by ID ─────────────────────────────────────────────────────────────

    public PrescriptionDto getById(UUID prescriptionId, UUID currentUserId, Role role) {
        Prescription p = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> AppException.notFound("Prescription not found"));

        assertAccess(p, currentUserId, role);
        return PrescriptionDto.from(p);
    }

    // ── Get by consultation ───────────────────────────────────────────────────

    public List<PrescriptionDto> getByConsultation(UUID consultationId,
                                                    UUID currentUserId, Role role) {
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> AppException.notFound("Consultation not found"));

        boolean isPatient  = role == Role.PATIENT  &&
                consultation.getAppointment().getPatient().getUserId().equals(currentUserId);
        boolean isProvider = role == Role.PROVIDER &&
                consultation.getAppointment().getProvider().getUserId().equals(currentUserId);
        if (!isPatient && !isProvider && role != Role.ADMIN) {
            throw AppException.forbidden("You do not have access to these prescriptions");
        }

        return prescriptionRepository
                .findByConsultation_ConsultationIdOrderByIssuedAtDesc(consultationId)
                .stream()
                .map(PrescriptionDto::from)
                .toList();
    }

    // ── My prescriptions ──────────────────────────────────────────────────────

    public List<PrescriptionDto> getMyPrescriptions(UUID userId, Role role) {
        List<Prescription> list = (role == Role.PATIENT)
                ? prescriptionRepository.findByPatient_UserIdOrderByIssuedAtDesc(userId)
                : prescriptionRepository.findByProvider_UserIdOrderByIssuedAtDesc(userId);

        return list.stream().map(PrescriptionDto::from).toList();
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public PrescriptionDto cancel(UUID prescriptionId, UUID providerUserId) {
        Prescription p = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> AppException.notFound("Prescription not found"));

        if (!p.getProvider().getUserId().equals(providerUserId)) {
            throw AppException.forbidden("You did not issue this prescription");
        }
        if (p.getStatus() != PrescriptionStatus.PENDING && p.getStatus() != PrescriptionStatus.PROCESSING) {
            throw AppException.badRequest(
                    "Only PENDING or PROCESSING prescriptions can be cancelled. Current: " + p.getStatus());
        }

        p.setStatus(PrescriptionStatus.CANCELLED);
        Prescription saved = prescriptionRepository.save(p);
        rebuildEhrMedications(saved.getPatient());
        return PrescriptionDto.from(saved);
    }

    // ── EHR rebuild ───────────────────────────────────────────────────────────

    /**
     * Rebuilds the patient's EHR medications list from every prescription that
     * is still active (not CANCELLED / FAILED / EXPIRED and validUntil >= today).
     * Deduplicates by medication name so the same drug from two overlapping
     * prescriptions only appears once.
     *
     * Called after issuing, cancelling, or expiring a prescription so the
     * EHR always reflects what the patient is currently supposed to be taking.
     */
    void rebuildEhrMedications(Patient patient) {
        List<Prescription> activePrescriptions = prescriptionRepository
                .findByPatient_UserIdOrderByIssuedAtDesc(patient.getUserId())
                .stream()
                .filter(p -> p.getStatus() != PrescriptionStatus.CANCELLED
                          && p.getStatus() != PrescriptionStatus.FAILED
                          && p.getStatus() != PrescriptionStatus.EXPIRED
                          && p.getValidUntil() != null
                          && !p.getValidUntil().isBefore(LocalDate.now()))
                .toList();

        // Merge all medication lists, deduplicate by lower-cased name (keep first occurrence)
        Map<String, MedicationItem> deduplicated = new LinkedHashMap<>();
        activePrescriptions.stream()
                .flatMap(p -> {
                    try {
                        return objectMapper.readValue(
                                p.getMedications(), new TypeReference<List<MedicationItem>>() {}).stream();
                    } catch (JsonProcessingException ex) {
                        return Stream.empty();
                    }
                })
                .forEach(med -> deduplicated.putIfAbsent(med.name().toLowerCase(), med));

        List<MedicationItem> merged = new ArrayList<>(deduplicated.values());

        HealthRecord ehr = healthRecordRepository.findByPatientUserId(patient.getUserId())
                .orElseGet(() -> {
                    HealthRecord r = new HealthRecord();
                    r.setPatient(patient);
                    return r;
                });

        try {
            ehr.setMedications(objectMapper.writeValueAsString(merged));
            healthRecordRepository.save(ehr);
            log.debug("EHR medications rebuilt for patient={}: {} active medication(s)",
                    patient.getUserId(), merged.size());
        } catch (JsonProcessingException e) {
            log.warn("Failed to rebuild EHR medications for patient={}: {}",
                    patient.getUserId(), e.getMessage());
        }
    }

    // ── Expiry ────────────────────────────────────────────────────────────────

    /**
     * Marks overdue prescriptions as EXPIRED and rebuilds EHR for each
     * affected patient.  Called by {@code PrescriptionSlaJob} nightly.
     * Only PENDING, PROCESSING, and READY_FOR_DELIVERY are targeted —
     * PICKED_UP and ON_THE_WAY are in-flight deliveries that should complete.
     */
    @Transactional
    public void expireOverdue() {
        List<Prescription> overdue = prescriptionRepository.findExpirable(
                List.of(PrescriptionStatus.PENDING,
                        PrescriptionStatus.PROCESSING,
                        PrescriptionStatus.READY_FOR_DELIVERY),
                LocalDate.now());

        if (overdue.isEmpty()) return;

        log.info("Expiry job: marking {} prescription(s) as EXPIRED", overdue.size());

        overdue.forEach(p -> {
            p.setStatus(PrescriptionStatus.EXPIRED);
            prescriptionRepository.save(p);
            rebuildEhrMedications(p.getPatient());

            // Notify patient their prescription has lapsed
            notificationPublisher.publish(
                    rw.shcp.notifications.NotificationEvent.push(
                            p.getPatient().getUserId(),
                            "prescription.expired",
                            "Your prescription issued by Dr. " + p.getProvider().getUser().getName()
                                    + " expired on " + p.getValidUntil()
                                    + ". Please consult your doctor if you still need medication.",
                            Map.of("prescriptionId", p.getPrescriptionId().toString(),
                                   "validUntil",     p.getValidUntil().toString())));

            log.info("Prescription {} expired — EHR rebuilt for patient={}",
                    p.getPrescriptionId(), p.getPatient().getUserId());
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Checks if any medication name matches the patient's recorded allergies.
     * Throws 400 so the provider sees a clear warning before proceeding.
     */
    private void checkAllergyConflicts(Patient patient, List<MedicationItem> medications) {
        healthRecordRepository.findByPatientUserId(patient.getUserId()).ifPresent(ehr -> {
            try {
                List<Map<String, Object>> allergies = objectMapper.readValue(
                        ehr.getAllergies() != null ? ehr.getAllergies() : "[]",
                        new TypeReference<>() {});
                for (MedicationItem med : medications) {
                    for (Map<String, Object> allergy : allergies) {
                        String allergen = String.valueOf(allergy.getOrDefault("name", ""))
                                .toLowerCase();
                        if (!allergen.isBlank() &&
                                med.name().toLowerCase().contains(allergen)) {
                            throw AppException.badRequest(
                                    "ALLERGY ALERT: Patient is allergic to '" + allergen +
                                    "'. Medication '" + med.name() + "' may cause a reaction. " +
                                    "Override by removing the conflicting medication or updating patient allergies.");
                        }
                    }
                }
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
                log.warn("Could not parse patient allergies for patient={}", patient.getUserId());
            }
        });
    }

    /** Known drug-drug interaction pairs (simplified lookup table). */
    private static final List<String[]> INTERACTION_PAIRS = List.of(
            new String[]{"warfarin",    "aspirin"},
            new String[]{"warfarin",    "ibuprofen"},
            new String[]{"metformin",   "alcohol"},
            new String[]{"ssri",        "tramadol"},
            new String[]{"methotrexate","nsaid"},
            new String[]{"digoxin",     "amiodarone"},
            new String[]{"simvastatin", "clarithromycin"},
            new String[]{"clopidogrel", "omeprazole"}
    );

    private void checkDrugInteractions(List<MedicationItem> medications) {
        List<String> names = medications.stream()
                .map(m -> m.name().toLowerCase())
                .toList();
        for (String[] pair : INTERACTION_PAIRS) {
            boolean hasA = names.stream().anyMatch(n -> n.contains(pair[0]));
            boolean hasB = names.stream().anyMatch(n -> n.contains(pair[1]));
            if (hasA && hasB) {
                log.warn("Drug interaction detected: {} ↔ {}", pair[0], pair[1]);
                throw AppException.badRequest(
                        "DRUG INTERACTION: Potential interaction between '" + pair[0] +
                        "' and '" + pair[1] + "'. Please review before prescribing.");
            }
        }
    }

    private String serializeMedications(List<MedicationItem> medications) {
        try {
            return objectMapper.writeValueAsString(medications);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize medications", e);
        }
    }

    private void assertAccess(Prescription p, UUID userId, Role role) {
        boolean isPatient  = role == Role.PATIENT  && p.getPatient().getUserId().equals(userId);
        boolean isProvider = role == Role.PROVIDER && p.getProvider().getUserId().equals(userId);
        boolean isAdmin    = role == Role.ADMIN;
        if (!isPatient && !isProvider && !isAdmin) {
            throw AppException.forbidden("You do not have access to this prescription");
        }
    }

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public PrescriptionDto notifyPharmacy(UUID prescriptionId, UUID providerUserId) {
        Prescription p = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> AppException.notFound("Prescription not found"));

        if (!p.getProvider().getUserId().equals(providerUserId)) {
            throw AppException.forbidden("You are not the provider for this prescription");
        }

        String providerName = p.getProvider().getUser().getName();
        String patientName  = p.getPatient().getUser().getName();
        String message = "Prescription for " + patientName +
                         " issued by Dr. " + providerName +
                         " is ready for dispensing. Valid until: " + p.getValidUntil();

        Map<String, Object> meta = Map.of(
                "prescriptionId", p.getPrescriptionId().toString(),
                "patientId",      p.getPatient().getUserId().toString(),
                "validUntil",     p.getValidUntil().toString()
        );

        // Notify patient that pharmacy has been informed
        notificationPublisher.publish(NotificationEvent.push(
                p.getPatient().getUserId(), "prescription.pharmacy", message, meta));

        // Notify provider (confirmation)
        notificationPublisher.publish(NotificationEvent.push(
                p.getProvider().getUserId(), "prescription.pharmacy", message, meta));

        log.info("Pharmacy notified for prescription={} patient={} provider={}",
                prescriptionId, p.getPatient().getUserId(), providerUserId);
        return PrescriptionDto.from(p);
    }

}
