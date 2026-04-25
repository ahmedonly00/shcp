package rw.shcp.users.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.appointments.AppointmentRepository;
import rw.shcp.common.exception.AppException;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.ehr.HealthRecordRepository;
import rw.shcp.symptoms.SymptomReportRepository;
import rw.shcp.users.dto.*;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.UserRepository;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PatientService {

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;
    private final HealthRecordRepository ehrRepository;
    private final SymptomReportRepository symptomRepository;
    private final AppointmentRepository appointmentRepository;
    private final ObjectMapper objectMapper;

    // ── Profile ───────────────────────────────────────────────

    @PreAuthorize("hasRole('PATIENT')")
    public PatientProfileDto getMyProfile(UUID userId) {
        Patient patient = findPatientOrThrow(userId);
        return PatientProfileDto.from(patient);
    }

    @Transactional
    @PreAuthorize("hasRole('PATIENT')")
    public PatientProfileDto updateMyProfile(UUID userId, UpdatePatientRequest req) {
        Patient patient = findPatientOrThrow(userId);
        User user = patient.getUser();

        if (req.name() != null)
            user.setName(req.name());
        if (req.phone() != null)
            user.setPhone(req.phone());
        if (req.languagePref() != null)
            user.setLanguagePref(req.languagePref());
        if (req.deviceToken() != null)
            user.setDeviceToken(req.deviceToken());
        if (req.bloodType() != null)
            patient.setBloodType(req.bloodType());
        if (req.insuranceNumber() != null)
            patient.setInsuranceNumber(req.insuranceNumber());
        if (req.dateOfBirth() != null)
            patient.setDateOfBirth(req.dateOfBirth());
        if (req.nationalId() != null)
            patient.setNationalId(req.nationalId());
        if (req.gender() != null)
            patient.setGender(req.gender());
        if (req.emergencyContactName() != null)
            patient.setEmergencyContactName(req.emergencyContactName());
        if (req.emergencyContactPhone() != null)
            patient.setEmergencyContactPhone(req.emergencyContactPhone());
        if (req.insuranceProvider() != null)
            patient.setInsuranceProvider(req.insuranceProvider());

        userRepository.save(user);
        patientRepository.save(patient);
        return PatientProfileDto.from(patient);
    }

    // ── EHR ───────────────────────────────────────────────────

    /**
     * Returns the patient's health record.
     * Creates an empty record lazily on first access if none exists.
     */
    @PreAuthorize("hasRole('PATIENT')")
    @Transactional
    public HealthRecordDto getMyEhr(UUID userId) {
        Patient patient = findPatientOrThrow(userId);
        HealthRecord ehr = ehrRepository.findByPatientUserId(userId)
                .orElseGet(() -> createEmptyEhr(patient));
        return HealthRecordDto.from(ehr);
    }

    // ── Activity log ──────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PATIENT')")
    public HealthRecordDto appendActivityLog(UUID userId, String entryJson) {
        Patient patient = findPatientOrThrow(userId);
        HealthRecord ehr = ehrRepository.findByPatientUserId(userId)
                .orElseGet(() -> createEmptyEhr(patient));

        try {
            JsonNode entry = objectMapper.readTree(entryJson);
            String existing = ehr.getActivityLogs();
            ArrayNode array;
            if (existing == null || existing.isBlank()) {
                array = objectMapper.createArrayNode();
            } else {
                JsonNode parsed = objectMapper.readTree(existing);
                array = parsed.isArray()
                        ? (ArrayNode) parsed
                        : objectMapper.createArrayNode();
            }
            array.add(entry);
            ehr.setActivityLogs(objectMapper.writeValueAsString(array));
        } catch (Exception e) {
            throw AppException.badRequest("Invalid activity log entry: " + e.getMessage());
        }

        return HealthRecordDto.from(ehrRepository.save(ehr));
    }

    // ── EHR file attachment ───────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PATIENT')")
    public HealthRecordDto appendDocument(UUID userId, DocumentEntryRequest entry) {
        Patient patient = findPatientOrThrow(userId);
        HealthRecord ehr = ehrRepository.findByPatientUserId(userId)
                .orElseGet(() -> createEmptyEhr(patient));

        try {
            ObjectNode newDoc = objectMapper.createObjectNode();
            newDoc.put("title",       entry.title());
            newDoc.put("date",        entry.date());
            newDoc.put("fileUrl",     entry.fileUrl());
            newDoc.put("storedName",  entry.storedName());
            newDoc.put("contentType", entry.contentType() != null
                    ? entry.contentType() : "application/octet-stream");

            String existing = ehr.getDocuments();
            ArrayNode array;
            if (existing == null || existing.isBlank()) {
                array = objectMapper.createArrayNode();
            } else {
                JsonNode parsed = objectMapper.readTree(existing);
                array = parsed.isArray()
                        ? (ArrayNode) parsed
                        : objectMapper.createArrayNode();
            }
            array.add(newDoc);
            ehr.setDocuments(objectMapper.writeValueAsString(array));
        } catch (Exception e) {
            throw AppException.badRequest("Failed to append document: " + e.getMessage());
        }

        return HealthRecordDto.from(ehrRepository.save(ehr));
    }

    // ── EHR update ────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PATIENT')")
    public HealthRecordDto updateMyEhr(UUID userId, UpdateEhrRequest req) {
        Patient patient = findPatientOrThrow(userId);
        HealthRecord ehr = ehrRepository.findByPatientUserId(userId)
                .orElseGet(() -> createEmptyEhr(patient));

        if (req.diagnoses()     != null) ehr.setDiagnoses(req.diagnoses());
        if (req.medications()   != null) ehr.setMedications(req.medications());
        if (req.allergies()     != null) ehr.setAllergies(req.allergies());
        if (req.vitals()        != null) ehr.setVitals(req.vitals());
        if (req.immunizations() != null) ehr.setImmunizations(req.immunizations());
        if (req.labResults()    != null) ehr.setLabResults(req.labResults());
        if (req.documents()     != null) ehr.setDocuments(req.documents());
        if (req.goals()         != null) ehr.setGoals(req.goals());
        if (req.activityLogs()  != null) ehr.setActivityLogs(req.activityLogs());

        return HealthRecordDto.from(ehrRepository.save(ehr));
    }

    // ── Symptom history ───────────────────────────────────────

    @PreAuthorize("hasRole('PATIENT')")
    public Page<SymptomReportSummaryDto> getMySymptomReports(UUID userId, Pageable pageable) {
        return symptomRepository
                .findByPatientUserId(userId, pageable)
                .map(SymptomReportSummaryDto::from);
    }

    // ── Appointments ──────────────────────────────────────────

    @PreAuthorize("hasRole('PATIENT')")
    public Page<AppointmentSummaryDto> getMyAppointments(UUID userId, Pageable pageable) {
        return appointmentRepository
                .findByPatientUserId(userId, pageable)
                .map(AppointmentSummaryDto::from);
    }

    // ── Helpers ───────────────────────────────────────────────

    private Patient findPatientOrThrow(UUID userId) {
        return patientRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Patient profile not found"));
    }

    private HealthRecord createEmptyEhr(Patient patient) {
        HealthRecord ehr = new HealthRecord();
        ehr.setPatient(patient);
        return ehrRepository.save(ehr);
    }
}
