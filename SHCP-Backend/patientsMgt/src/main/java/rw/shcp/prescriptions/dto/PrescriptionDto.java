package rw.shcp.prescriptions.dto;

import rw.shcp.prescriptions.Prescription;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PrescriptionDto(
        UUID           prescriptionId,
        UUID           consultationId,
        UUID           patientId,
        UUID           providerId,
        UUID           pharmacyId,
        String         patientName,
        String         providerName,
        String         pharmacyName,
        String         medications,   // raw JSON array
        String         instructions,
        String         providerSignature,
        String         deliveryAddress,
        String         deliveryDistrict,
        String         deliverySector,
        String         deliveryCell,
        Double         deliveryLatitude,
        Double         deliveryLongitude,
        OffsetDateTime issuedAt,
        LocalDate      validUntil,
        String         status
) {
    public static PrescriptionDto from(Prescription p) {
        return new PrescriptionDto(
                p.getPrescriptionId(),
                p.getConsultation() != null ? p.getConsultation().getConsultationId() : null,
                p.getPatient().getUserId(),
                p.getProvider().getUserId(),
                p.getPharmacy() != null ? p.getPharmacy().getPharmacyId() : null,
                p.getPatient().getUser().getName(),
                p.getProvider().getUser().getName(),
                p.getPharmacy() != null ? p.getPharmacy().getName() : null,
                p.getMedications(),
                p.getInstructions(),
                p.getProviderSignature(),
                p.getDeliveryAddress(),
                p.getDeliveryDistrict(),
                p.getDeliverySector(),
                p.getDeliveryCell(),
                p.getDeliveryLatitude(),
                p.getDeliveryLongitude(),
                p.getIssuedAt(),
                p.getValidUntil(),
                p.getStatus().name()
        );
    }
}
