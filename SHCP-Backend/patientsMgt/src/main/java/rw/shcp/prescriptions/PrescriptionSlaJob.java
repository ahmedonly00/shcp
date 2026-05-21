package rw.shcp.prescriptions;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.enums.PrescriptionStatus;
import rw.shcp.common.enums.Role;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.pharmacy.Pharmacy;
import rw.shcp.pharmacy.PharmacistRepository;
import rw.shcp.pharmacy.PharmacyService;
import rw.shcp.users.repository.UserRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gap #7 + #9 — SLA enforcement and pharmacy-to-pharmacy re-routing.
 *
 * <p>Runs every {@code shcp.sla.check-interval-ms} milliseconds (default 15 min).
 * Any PENDING prescription that has not been acknowledged by its assigned pharmacy
 * within {@code shcp.sla.pending-threshold-minutes} (default 30 min) is escalated:
 *
 * <ol>
 *   <li>Try to re-route to a different nearest pharmacy (excludes the unresponsive one).</li>
 *   <li>If a new pharmacy is found → update the assignment and notify new pharmacists.</li>
 *   <li>If no alternative pharmacy → notify all admins to intervene manually.</li>
 * </ol>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PrescriptionSlaJob {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionService    prescriptionService;
    private final PharmacyService        pharmacyService;
    private final PharmacistRepository   pharmacistRepository;
    private final UserRepository         userRepository;
    private final NotificationPublisher  notificationPublisher;

    @Value("${shcp.sla.pending-threshold-minutes:30}")
    private int pendingThresholdMinutes;

    /** Runs at 01:00 every night — marks overdue prescriptions EXPIRED and prunes EHR. */
    @Scheduled(cron = "0 0 1 * * *")
    public void expireOverduePrescriptions() {
        prescriptionService.expireOverdue();
    }

    @Scheduled(fixedDelayString = "${shcp.sla.check-interval-ms:900000}") // default 15 min
    @Transactional
    public void checkStalePrescriptions() {
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(pendingThresholdMinutes);
        List<Prescription> stale = prescriptionRepository.findStalePending(
                PrescriptionStatus.PENDING, threshold);

        if (stale.isEmpty()) return;

        log.info("SLA check: found {} stale PENDING prescription(s) older than {} minutes",
                stale.size(), pendingThresholdMinutes);

        stale.forEach(p -> {
            try {
                escalate(p);
            } catch (Exception e) {
                log.error("SLA escalation failed for prescription={}: {}",
                        p.getPrescriptionId(), e.getMessage(), e);
            }
        });
    }

    // ── Escalation logic ──────────────────────────────────────────────────────

    private void escalate(Prescription p) {
        UUID oldPharmacyId = p.getPharmacy().getPharmacyId();
        log.warn("SLA breach: prescription={} has been PENDING for >{}min at pharmacy={}",
                p.getPrescriptionId(), pendingThresholdMinutes, oldPharmacyId);

        // Extract medication names for stock-aware re-routing
        List<String> medNames = extractMedNames(p.getMedications());

        try {
            // Gap #9: attempt pharmacy-to-pharmacy re-routing, excluding the unresponsive one
            Pharmacy alternative = pharmacyService.resolveNearest(
                    p.getDeliveryDistrict(), p.getDeliverySector(), p.getDeliveryCell(),
                    p.getDeliveryLatitude(), p.getDeliveryLongitude(),
                    medNames, oldPharmacyId);

            // Re-assign
            p.setPharmacy(alternative);
            prescriptionRepository.save(p);

            log.info("SLA re-routed: prescription={} → new pharmacy={}",
                    p.getPrescriptionId(), alternative.getPharmacyId());

            // Notify new pharmacists
            notifyPharmacists(p, alternative, "Re-assigned after SLA breach from previous pharmacy.");

        } catch (rw.shcp.common.exception.AppException ex) {
            // No alternative pharmacy — escalate to all admins
            log.error("SLA escalation: no alternative pharmacy for prescription={} — notifying admins",
                    p.getPrescriptionId());
            notifyAdmins(p);
        }
    }

    // ── Notification helpers ──────────────────────────────────────────────────

    private void notifyPharmacists(Prescription p, Pharmacy pharmacy, String note) {
        String msg = "URGENT: Prescription for " + p.getPatient().getUser().getName()
                + " re-assigned to your pharmacy. " + note
                + " Please process immediately.";
        Map<String, Object> meta = Map.of(
                "prescriptionId", p.getPrescriptionId().toString(),
                "pharmacyId",     pharmacy.getPharmacyId().toString());

        pharmacistRepository.findAllByPharmacy_PharmacyId(pharmacy.getPharmacyId())
                .forEach(ph -> {
                    notificationPublisher.publish(NotificationEvent.push(
                            ph.getUserId(), "prescription.sla_reassigned", msg, meta));
                });
    }

    private void notifyAdmins(Prescription p) {
        String msg = "SLA ALERT: Prescription " + p.getPrescriptionId()
                + " for patient " + p.getPatient().getUser().getName()
                + " has been PENDING for over " + pendingThresholdMinutes
                + " minutes and no alternative pharmacy is available. Manual intervention required.";
        Map<String, Object> meta = Map.of("prescriptionId", p.getPrescriptionId().toString());

        userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.ADMIN)
                .forEach(admin -> notificationPublisher.publish(
                        NotificationEvent.push(admin.getUserId(), "prescription.sla_alert", msg, meta)));
    }

    // ── Medication name extraction ────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<String> extractMedNames(String medicationsJson) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            List<Map<String, Object>> meds = mapper.readValue(medicationsJson,
                    new com.fasterxml.jackson.core.type.TypeReference<>() {});
            return meds.stream()
                    .map(m -> String.valueOf(m.getOrDefault("name", "")).toLowerCase())
                    .filter(s -> !s.isBlank())
                    .toList();
        } catch (Exception e) {
            log.warn("SLA job could not parse medications JSON: {}", e.getMessage());
            return List.of();
        }
    }
}
