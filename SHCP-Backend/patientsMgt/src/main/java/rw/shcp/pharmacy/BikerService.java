package rw.shcp.pharmacy;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import rw.shcp.common.enums.BikerStatus;
import rw.shcp.common.enums.DeliveryStatus;
import rw.shcp.common.enums.PrescriptionStatus;
import rw.shcp.common.exception.AppException;
import rw.shcp.common.storage.FileStorageService;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.pharmacy.dto.BikerDto;
import rw.shcp.pharmacy.dto.DeliveryDto;
import rw.shcp.pharmacy.dto.UpdateDeliveryStatusRequest;
import rw.shcp.prescriptions.Prescription;
import rw.shcp.prescriptions.PrescriptionRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class BikerService {

    private final BikerRepository        bikerRepository;
    private final DeliveryRepository     deliveryRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PharmacistRepository   pharmacistRepository;
    private final NotificationPublisher  notificationPublisher;
    private final FileStorageService     fileStorageService;

    // ── Self profile ──────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('BIKER')")
    public BikerDto getMyProfile(UUID userId) {
        return BikerDto.from(resolveBiker(userId));
    }

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public BikerDto setStatus(UUID userId, BikerStatus status) {
        Biker biker = resolveBiker(userId);
        if (biker.getStatus() == BikerStatus.ON_DELIVERY && status == BikerStatus.OFFLINE) {
            throw AppException.badRequest("Cannot go offline while on an active delivery");
        }
        biker.setStatus(status);
        bikerRepository.save(biker);
        return BikerDto.from(biker);
    }

    // ── My orders ─────────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('BIKER')")
    public List<DeliveryDto> getMyOrders(UUID userId) {
        return deliveryRepository.findAllByBiker_UserIdOrderByCreatedAtDesc(userId)
                .stream().map(DeliveryDto::from).toList();
    }

    @PreAuthorize("hasRole('BIKER')")
    public DeliveryDto getOrderById(UUID deliveryId, UUID userId) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> AppException.notFound("Delivery not found"));
        // biker_id is nullable (ON DELETE SET NULL)
        if (delivery.getBiker() == null || !delivery.getBiker().getUserId().equals(userId)) {
            throw AppException.forbidden("This delivery is not assigned to you");
        }
        return DeliveryDto.from(delivery);
    }

    // ── Accept order ──────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public DeliveryDto accept(UUID deliveryId, UUID userId) {
        Delivery delivery = getAndValidateDelivery(deliveryId, userId);
        if (delivery.getStatus() != DeliveryStatus.ASSIGNED) {
            throw AppException.badRequest("Order must be in ASSIGNED state to accept. Current: " + delivery.getStatus());
        }
        delivery.setStatus(DeliveryStatus.ACCEPTED);
        delivery.setAcceptedAt(OffsetDateTime.now());
        Delivery saved = deliveryRepository.save(delivery);
        log.info("Delivery {} accepted by biker={}", deliveryId, userId);
        return DeliveryDto.from(saved);
    }

    // ── Decline order ─────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public DeliveryDto decline(UUID deliveryId, UUID userId) {
        Delivery delivery = getAndValidateDelivery(deliveryId, userId);
        if (delivery.getStatus() != DeliveryStatus.ASSIGNED) {
            throw AppException.badRequest("Order must be in ASSIGNED state to decline. Current: " + delivery.getStatus());
        }
        delivery.setStatus(DeliveryStatus.DECLINED);
        Delivery saved = deliveryRepository.save(delivery);

        // Free the biker
        Biker biker = resolveBiker(userId);
        biker.setStatus(BikerStatus.AVAILABLE);
        bikerRepository.save(biker);

        // Alert pharmacist(s) of this pharmacy
        notifyPharmacyUsers(delivery,
                "Biker " + biker.getUser().getName() + " declined delivery order. Please reassign.",
                "delivery.declined");

        log.info("Delivery {} declined by biker={}", deliveryId, userId);
        return DeliveryDto.from(saved);
    }

    // ── Mark picked up ────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public DeliveryDto markPickedUp(UUID deliveryId, UUID userId) {
        Delivery delivery = getAndValidateDelivery(deliveryId, userId);
        if (delivery.getStatus() != DeliveryStatus.ACCEPTED) {
            throw AppException.badRequest("Order must be ACCEPTED before marking as PICKED_UP");
        }
        delivery.setStatus(DeliveryStatus.PICKED_UP);
        delivery.setPickedUpAt(OffsetDateTime.now());
        updatePrescriptionStatus(delivery.getPrescription(), PrescriptionStatus.PICKED_UP);
        Delivery saved = deliveryRepository.save(delivery);

        // Notify patient
        notificationPublisher.publish(NotificationEvent.push(
                delivery.getPrescription().getPatient().getUserId(), "delivery.picked_up",
                "Your medication has been picked up and is on its way to you.",
                Map.of("deliveryId", deliveryId.toString())));

        log.info("Delivery {} picked up by biker={}", deliveryId, userId);
        return DeliveryDto.from(saved);
    }

    // ── Mark on the way ───────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public DeliveryDto markOnTheWay(UUID deliveryId, UUID userId) {
        Delivery delivery = getAndValidateDelivery(deliveryId, userId);
        if (delivery.getStatus() != DeliveryStatus.PICKED_UP) {
            throw AppException.badRequest("Order must be PICKED_UP before marking as ON_THE_WAY");
        }
        delivery.setStatus(DeliveryStatus.ON_THE_WAY);
        updatePrescriptionStatus(delivery.getPrescription(), PrescriptionStatus.ON_THE_WAY);
        Delivery saved = deliveryRepository.save(delivery);

        notificationPublisher.publish(NotificationEvent.push(
                delivery.getPrescription().getPatient().getUserId(), "delivery.on_the_way",
                "Your medication is on its way! The biker is en route to your address.",
                Map.of("deliveryId", deliveryId.toString())));

        log.info("Delivery {} on the way, biker={}", deliveryId, userId);
        return DeliveryDto.from(saved);
    }

    // ── Mark delivered ────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public DeliveryDto markDelivered(UUID deliveryId, UUID userId, MultipartFile photo) {
        Delivery delivery = getAndValidateDelivery(deliveryId, userId);
        if (delivery.getStatus() != DeliveryStatus.ON_THE_WAY) {
            throw AppException.badRequest("Order must be ON_THE_WAY before marking as DELIVERED");
        }

        if (photo != null && !photo.isEmpty()) {
            try {
                String url = fileStorageService.store(photo, userId);
                delivery.setConfirmationPhotoUrl(url);
            } catch (java.io.IOException e) {
                throw AppException.badRequest("Failed to store confirmation photo: " + e.getMessage());
            }
        }

        delivery.setStatus(DeliveryStatus.DELIVERED);
        delivery.setDeliveredAt(OffsetDateTime.now());
        updatePrescriptionStatus(delivery.getPrescription(), PrescriptionStatus.DELIVERED);

        // Free the biker
        Biker biker = resolveBiker(userId);
        biker.setStatus(BikerStatus.AVAILABLE);
        bikerRepository.save(biker);

        Delivery saved = deliveryRepository.save(delivery);

        Prescription p = delivery.getPrescription();
        String patientName = p.getPatient().getUser().getName();

        // Notify patient
        notificationPublisher.publish(NotificationEvent.push(
                p.getPatient().getUserId(), "delivery.delivered",
                "Your medication has been delivered. Thank you for using SHCP!",
                Map.of("deliveryId", deliveryId.toString())));

        // Notify provider
        notificationPublisher.publish(NotificationEvent.push(
                p.getProvider().getUserId(), "delivery.delivered",
                "Prescription for " + patientName + " has been successfully delivered.",
                Map.of("prescriptionId", p.getPrescriptionId().toString())));

        log.info("Delivery {} marked DELIVERED by biker={}", deliveryId, userId);
        return DeliveryDto.from(saved);
    }

    // ── Update biker GPS location ─────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public void updateLocation(UUID deliveryId, UUID userId, double latitude, double longitude) {
        Delivery delivery = getAndValidateDelivery(deliveryId, userId);
        DeliveryStatus s = delivery.getStatus();
        if (s != DeliveryStatus.ACCEPTED &&
                s != DeliveryStatus.PICKED_UP &&
                s != DeliveryStatus.ON_THE_WAY) {
            throw AppException.badRequest("Cannot update location for delivery in state: " + s);
        }
        delivery.setBikerLatitude(latitude);
        delivery.setBikerLongitude(longitude);
        delivery.setLocationUpdatedAt(OffsetDateTime.now());
        deliveryRepository.save(delivery);
        log.debug("Location updated for delivery={} biker={} [{},{}]", deliveryId, userId, latitude, longitude);
    }

    // ── Mark failed ───────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('BIKER')")
    public DeliveryDto markFailed(UUID deliveryId, UUID userId, UpdateDeliveryStatusRequest req) {
        Delivery delivery = getAndValidateDelivery(deliveryId, userId);
        if (delivery.getStatus() != DeliveryStatus.ON_THE_WAY &&
                delivery.getStatus() != DeliveryStatus.ACCEPTED) {
            throw AppException.badRequest("Cannot fail an order in state: " + delivery.getStatus());
        }

        delivery.setStatus(DeliveryStatus.FAILED);
        delivery.setFailureReason(req.failureReason());
        updatePrescriptionStatus(delivery.getPrescription(), PrescriptionStatus.FAILED);

        Biker biker = resolveBiker(userId);
        biker.setStatus(BikerStatus.AVAILABLE);
        bikerRepository.save(biker);

        Delivery saved = deliveryRepository.save(delivery);

        Prescription p = delivery.getPrescription();

        // Notify patient
        notificationPublisher.publish(NotificationEvent.push(
                p.getPatient().getUserId(), "delivery.failed",
                "Delivery attempt failed. Reason: " + req.failureReason() +
                        ". Please contact the pharmacy for assistance.",
                Map.of("deliveryId", deliveryId.toString())));

        // Alert pharmacy
        notifyPharmacyUsers(delivery,
                "Delivery failed for patient " + p.getPatient().getUser().getName() +
                        ". Reason: " + req.failureReason(),
                "delivery.failed");

        log.warn("Delivery {} failed by biker={}, reason={}", deliveryId, userId, req.failureReason());
        return DeliveryDto.from(saved);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Biker resolveBiker(UUID userId) {
        return bikerRepository.findByUser_UserId(userId)
                .orElseThrow(() -> AppException.notFound("Biker profile not found"));
    }

    private Delivery getAndValidateDelivery(UUID deliveryId, UUID userId) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> AppException.notFound("Delivery not found"));
        // biker_id is nullable (ON DELETE SET NULL), so guard against a null biker
        if (delivery.getBiker() == null || !delivery.getBiker().getUserId().equals(userId)) {
            throw AppException.forbidden("This delivery is not assigned to you");
        }
        return delivery;
    }

    private void updatePrescriptionStatus(Prescription p, PrescriptionStatus status) {
        p.setStatus(status);
        prescriptionRepository.save(p);
    }

    private void notifyPharmacyUsers(Delivery delivery, String message, String eventType) {
        Pharmacy pharmacy = delivery.getPrescription().getPharmacy();
        if (pharmacy == null) {
            // Prescription's pharmacy_id was NULLed (ON DELETE SET NULL) — nothing to fan out to
            log.warn("notifyPharmacyUsers: prescription {} has no pharmacy, skipping pharmacist notification",
                    delivery.getPrescription().getPrescriptionId());
            return;
        }
        UUID pharmacyId = pharmacy.getPharmacyId();
        Map<String, Object> meta = Map.of(
                "deliveryId",      delivery.getDeliveryId().toString(),
                "prescriptionId",  delivery.getPrescription().getPrescriptionId().toString());

        // Fan out to every pharmacist at this pharmacy
        pharmacistRepository.findAllByPharmacy_PharmacyId(pharmacyId)
                .forEach(pharmacist -> notificationPublisher.publish(
                        NotificationEvent.push(pharmacist.getUserId(), eventType, message, meta)));
    }
}
