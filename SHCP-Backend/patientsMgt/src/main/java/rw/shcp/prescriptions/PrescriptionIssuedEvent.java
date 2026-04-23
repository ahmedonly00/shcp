package rw.shcp.prescriptions;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published (via Spring's {@link org.springframework.context.ApplicationEventPublisher}) after a
 * prescription row has been saved. The listener fires only AFTER_COMMIT so that
 * pharmacists are never notified for a prescription that was later rolled back.
 */
public record PrescriptionIssuedEvent(
        UUID prescriptionId,
        UUID patientId,
        String patientName,
        UUID providerId,
        String providerName,
        /** null when no active pharmacy was found near the delivery address. */
        UUID pharmacyId,
        String deliveryCell,
        String deliverySector,
        String deliveryDistrict,
        LocalDate validUntil
) {
    static PrescriptionIssuedEvent from(Prescription p) {
        return new PrescriptionIssuedEvent(
                p.getPrescriptionId(),
                p.getPatient().getUserId(),
                p.getPatient().getUser().getName(),
                p.getProvider().getUserId(),
                p.getProvider().getUser().getName(),
                p.getPharmacy() != null ? p.getPharmacy().getPharmacyId() : null,
                p.getDeliveryCell(),
                p.getDeliverySector(),
                p.getDeliveryDistrict(),
                p.getValidUntil()
        );
    }
}
