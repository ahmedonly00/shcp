package rw.shcp.referrals;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.exception.AppException;
import rw.shcp.consultations.ConsultationRepository;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.referrals.dto.CreateReferralRequest;
import rw.shcp.referrals.dto.ReferralDto;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class ReferralService {

    private final ReferralRepository    referralRepository;
    private final PatientRepository     patientRepository;
    private final ProviderRepository    providerRepository;
    private final ConsultationRepository consultationRepository;
    private final NotificationPublisher notificationPublisher;

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public ReferralDto create(UUID referringProviderId, CreateReferralRequest req) {
        Provider referring = providerRepository.findById(referringProviderId)
                .orElseThrow(() -> AppException.notFound("Referring provider not found"));
        Patient patient = patientRepository.findById(req.patientId())
                .orElseThrow(() -> AppException.notFound("Patient not found"));

        boolean isExternal = "EXTERNAL".equalsIgnoreCase(req.referralType());

        if (isExternal && (req.institutionName() == null || req.institutionName().isBlank())) {
            throw AppException.badRequest("Institution name is required for external referrals");
        }

        Referral referral = new Referral();
        referral.setPatient(patient);
        referral.setReferringProvider(referring);
        referral.setSpecialtyNeeded(req.specialtyNeeded());
        referral.setReason(req.reason());
        referral.setUrgency(req.urgency() != null ? req.urgency().toUpperCase() : "ROUTINE");
        referral.setNotes(req.notes());
        referral.setReferralType(isExternal ? "EXTERNAL" : "INTERNAL");
        referral.setInstitutionName(req.institutionName());
        referral.setInstitutionType(req.institutionType() != null ? req.institutionType().toUpperCase() : null);
        referral.setInstitutionAddress(req.institutionAddress());
        referral.setInstitutionContact(req.institutionContact());
        referral.setTreatmentType(req.treatmentType() != null ? req.treatmentType().toUpperCase() : null);

        if (!isExternal && req.specialistId() != null) {
            Provider specialist = providerRepository.findById(req.specialistId())
                    .orElseThrow(() -> AppException.notFound("Specialist not found"));
            referral.setSpecialist(specialist);
        }
        if (req.consultationId() != null) {
            referral.setConsultation(consultationRepository.findById(req.consultationId())
                    .orElseThrow(() -> AppException.notFound("Consultation not found")));
        }

        Referral saved = referralRepository.save(referral);
        log.info("Referral {} created: patient={} referring={} type={} specialty={}",
                saved.getReferralId(), req.patientId(), referringProviderId,
                saved.getReferralType(), req.specialtyNeeded());

        // Build patient notification — richer message for external referrals
        String patientMsg;
        Map<String, Object> meta;
        if (isExternal) {
            patientMsg = "Dr. " + referring.getUser().getName() +
                    " has referred you to " + req.institutionName() +
                    " for " + (req.treatmentType() != null ? req.treatmentType().replace("_", " ").toLowerCase() : req.specialtyNeeded()) +
                    ". Reason: " + req.reason() +
                    (req.institutionAddress() != null ? ". Address: " + req.institutionAddress() : "") +
                    (req.institutionContact() != null ? ". Contact: " + req.institutionContact() : "");
            meta = new java.util.HashMap<>(Map.of(
                    "referralId",       saved.getReferralId().toString(),
                    "referralType",     "EXTERNAL",
                    "institutionName",  req.institutionName(),
                    "urgency",          saved.getUrgency()));
            if (req.institutionContact() != null) meta.put("institutionContact", req.institutionContact());
            if (req.institutionAddress() != null) meta.put("institutionAddress", req.institutionAddress());
        } else {
            patientMsg = "Dr. " + referring.getUser().getName() +
                    " has referred you to a " + req.specialtyNeeded() + " specialist. " +
                    "Reason: " + req.reason();
            meta = Map.of("referralId", saved.getReferralId().toString(), "referralType", "INTERNAL");
        }

        notificationPublisher.publish(NotificationEvent.email(
                patient.getUserId(), "referral.created", patientMsg, meta));
        notificationPublisher.publish(NotificationEvent.push(
                patient.getUserId(), "referral.created", patientMsg, meta));

        if (!isExternal && saved.getSpecialist() != null) {
            String specialistMsg = "Dr. " + referring.getUser().getName() +
                    " has referred a patient to you (" + req.specialtyNeeded() + "). " +
                    "Urgency: " + referral.getUrgency();
            notificationPublisher.publish(NotificationEvent.email(
                    saved.getSpecialist().getUserId(), "referral.assigned", specialistMsg,
                    Map.of("referralId", saved.getReferralId().toString())));
        }

        return ReferralDto.from(saved);
    }

    public List<ReferralDto> myReferrals(UUID providerId) {
        return referralRepository.findByReferringProvider_UserIdOrderByCreatedAtDesc(providerId)
                .stream().map(ReferralDto::from).toList();
    }

    public List<ReferralDto> myPatientReferrals(UUID patientId) {
        return referralRepository.findByPatient_UserIdOrderByCreatedAtDesc(patientId)
                .stream().map(ReferralDto::from).toList();
    }

    public List<ReferralDto> incomingReferrals(UUID specialistId) {
        return referralRepository.findBySpecialist_UserIdAndStatusOrderByCreatedAtDesc(
                specialistId, "PENDING")
                .stream().map(ReferralDto::from).toList();
    }

    @Transactional
    @PreAuthorize("hasRole('PROVIDER')")
    public ReferralDto updateStatus(UUID referralId, UUID providerId, String status) {
        Referral r = referralRepository.findById(referralId)
                .orElseThrow(() -> AppException.notFound("Referral not found"));
        boolean isSpecialist = r.getSpecialist() != null &&
                r.getSpecialist().getUserId().equals(providerId);
        boolean isReferring  = r.getReferringProvider().getUserId().equals(providerId);
        if (!isSpecialist && !isReferring) {
            throw AppException.forbidden("You do not have access to this referral");
        }
        r.setStatus(status.toUpperCase());
        return ReferralDto.from(referralRepository.save(r));
    }
}
