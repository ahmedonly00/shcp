package rw.shcp.referrals.dto;

import rw.shcp.referrals.Referral;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ReferralDto(
        UUID           referralId,
        UUID           patientId,
        String         patientName,
        UUID           referringProviderId,
        String         referringProviderName,
        UUID           specialistId,
        String         specialistName,
        String         specialistSpecialty,
        UUID           consultationId,
        String         specialtyNeeded,
        String         reason,
        String         urgency,
        String         status,
        String         notes,
        String         referralType,
        String         institutionName,
        String         institutionType,
        String         institutionAddress,
        String         institutionContact,
        String         treatmentType,
        OffsetDateTime createdAt
) {
    public static ReferralDto from(Referral r) {
        return new ReferralDto(
                r.getReferralId(),
                r.getPatient().getUserId(),
                r.getPatient().getUser().getName(),
                r.getReferringProvider().getUserId(),
                r.getReferringProvider().getUser().getName(),
                r.getSpecialist() != null ? r.getSpecialist().getUserId() : null,
                r.getSpecialist() != null ? r.getSpecialist().getUser().getName() : null,
                r.getSpecialist() != null ? r.getSpecialist().getSpecialty() : null,
                r.getConsultation() != null ? r.getConsultation().getConsultationId() : null,
                r.getSpecialtyNeeded(),
                r.getReason(),
                r.getUrgency(),
                r.getStatus(),
                r.getNotes(),
                r.getReferralType(),
                r.getInstitutionName(),
                r.getInstitutionType(),
                r.getInstitutionAddress(),
                r.getInstitutionContact(),
                r.getTreatmentType(),
                r.getCreatedAt()
        );
    }
}
