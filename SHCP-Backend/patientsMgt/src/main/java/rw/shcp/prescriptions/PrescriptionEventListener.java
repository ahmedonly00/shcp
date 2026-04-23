package rw.shcp.prescriptions;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.pharmacy.PharmacistRepository;

import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Fires AFTER the prescription transaction commits successfully.
 * This guarantees that pharmacists and patients are never notified for a
 * prescription that was rolled back due to a downstream DB error.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PrescriptionEventListener {

    private final PharmacistRepository   pharmacistRepository;
    private final NotificationPublisher  notificationPublisher;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPrescriptionIssued(PrescriptionIssuedEvent event) {
        notifyPatient(event);

        if (event.pharmacyId() != null) {
            notifyPharmacists(event);
        } else {
            notifyProviderNoPharmacy(event);
        }
    }

    // ── Patient notification ──────────────────────────────────────────────────

    private void notifyPatient(PrescriptionIssuedEvent e) {
        String message = "Dr. " + e.providerName() + " has issued you a new prescription. " +
                         "Valid until: " + e.validUntil();
        Map<String, Object> meta = Map.of(
                "prescriptionId", e.prescriptionId().toString(),
                "validUntil",     e.validUntil().toString());

        notificationPublisher.publish(NotificationEvent.email(
                e.patientId(), "prescription.issued", message, meta));
        notificationPublisher.publish(NotificationEvent.push(
                e.patientId(), "prescription.issued", message, meta));
    }

    // ── Pharmacist notifications ──────────────────────────────────────────────

    private void notifyPharmacists(PrescriptionIssuedEvent e) {
        String location = Stream.of(e.deliveryCell(), e.deliverySector(), e.deliveryDistrict())
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining(", "));

        String message = "New prescription from Dr. " + e.providerName() +
                " for patient " + e.patientName() +
                (location.isBlank() ? "" : " (delivery: " + location + ")") +
                ". Please prepare the medication.";

        Map<String, Object> meta = Map.of(
                "prescriptionId", e.prescriptionId().toString(),
                "pharmacyId",     e.pharmacyId().toString());

        pharmacistRepository.findAllByPharmacy_PharmacyId(e.pharmacyId())
                .forEach(pharmacist -> {
                    notificationPublisher.publish(NotificationEvent.push(
                            pharmacist.getUserId(), "prescription.incoming", message, meta));
                });

        log.debug("Notified pharmacists at pharmacy={} for prescription={}",
                e.pharmacyId(), e.prescriptionId());
    }

    // ── Provider notification when no pharmacy matched ────────────────────────

    private void notifyProviderNoPharmacy(PrescriptionIssuedEvent e) {
        notificationPublisher.publish(NotificationEvent.push(
                e.providerId(), "prescription.no_pharmacy",
                "No active pharmacy found near the patient's location. " +
                "Please contact a pharmacy directly.",
                Map.of("patientId", e.patientId().toString(),
                       "prescriptionId", e.prescriptionId().toString())));
    }
}
