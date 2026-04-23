package rw.shcp.pharmacy.dto;

import rw.shcp.pharmacy.Delivery;
import rw.shcp.prescriptions.Prescription;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DeliveryDto(
        UUID           deliveryId,
        UUID           prescriptionId,
        UUID           bikerId,
        String         bikerName,
        String         status,
        OffsetDateTime assignedAt,
        OffsetDateTime acceptedAt,
        OffsetDateTime pickedUpAt,
        OffsetDateTime deliveredAt,
        String         confirmationPhotoUrl,
        String         failureReason,
        OffsetDateTime createdAt,
        // ── Biker real-time GPS position ─────────────────────────────────────
        Double         bikerLatitude,
        Double         bikerLongitude,
        OffsetDateTime locationUpdatedAt,
        // ── Patient delivery destination (from Prescription) ─────────────────
        String         deliveryAddress,
        Double         destinationLatitude,
        Double         destinationLongitude
) {
    public static DeliveryDto from(Delivery d) {
        Prescription p = d.getPrescription();
        return new DeliveryDto(
                d.getDeliveryId(),
                p.getPrescriptionId(),
                d.getBiker() != null ? d.getBiker().getUserId()      : null,
                d.getBiker() != null ? d.getBiker().getUser().getName() : null,
                d.getStatus().name(),
                d.getAssignedAt(),
                d.getAcceptedAt(),
                d.getPickedUpAt(),
                d.getDeliveredAt(),
                d.getConfirmationPhotoUrl(),
                d.getFailureReason(),
                d.getCreatedAt(),
                d.getBikerLatitude(),
                d.getBikerLongitude(),
                d.getLocationUpdatedAt(),
                p.getDeliveryAddress(),
                p.getDeliveryLatitude(),
                p.getDeliveryLongitude()
        );
    }
}
