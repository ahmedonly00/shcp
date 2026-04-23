package rw.shcp.pharmacy;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.enums.BikerStatus;
import rw.shcp.common.enums.DeliveryStatus;
import rw.shcp.common.enums.PrescriptionStatus;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.pharmacy.dto.*;
import rw.shcp.prescriptions.Prescription;
import rw.shcp.prescriptions.PrescriptionRepository;
import rw.shcp.prescriptions.dto.PrescriptionDto;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.UserRepository;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class PharmacistService {

    private final PharmacistRepository        pharmacistRepository;
    private final BikerRepository             bikerRepository;
    private final PharmacyRepository          pharmacyRepository;
    private final PrescriptionRepository      prescriptionRepository;
    private final DeliveryRepository          deliveryRepository;
    private final PharmacyInventoryRepository inventoryRepository;
    private final UserRepository              userRepository;
    private final PasswordEncoder             passwordEncoder;
    private final NotificationPublisher       notificationPublisher;

    // ── Pharmacist self-resolution ────────────────────────────────────────────

    private Pharmacist resolvePharmacist(UUID userId) {
        return pharmacistRepository.findByUser_UserId(userId)
                .orElseThrow(() -> AppException.notFound("Pharmacist profile not found"));
    }

    // ── Prescriptions for this pharmacy ───────────────────────────────────────

    @PreAuthorize("hasRole('PHARMACIST')")
    public List<PrescriptionDto> getMyPrescriptions(UUID pharmacistUserId) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        return prescriptionRepository
                .findByPharmacy_PharmacyIdOrderByCreatedAtDesc(pharmacist.getPharmacy().getPharmacyId())
                .stream().map(PrescriptionDto::from).toList();
    }

    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public PrescriptionDto markProcessing(UUID prescriptionId, UUID pharmacistUserId) {
        Prescription p = getAndValidatePrescription(prescriptionId, pharmacistUserId);
        assertStatus(p, PrescriptionStatus.PENDING, "mark as PROCESSING");
        p.setStatus(PrescriptionStatus.PROCESSING);
        Prescription saved = prescriptionRepository.save(p);
        log.info("Prescription {} marked PROCESSING by pharmacist={}", prescriptionId, pharmacistUserId);
        return PrescriptionDto.from(saved);
    }

    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public PrescriptionDto markReadyForDelivery(UUID prescriptionId, UUID pharmacistUserId) {
        Prescription p = getAndValidatePrescription(prescriptionId, pharmacistUserId);
        assertStatus(p, PrescriptionStatus.PROCESSING, "mark as READY_FOR_DELIVERY");
        p.setStatus(PrescriptionStatus.READY_FOR_DELIVERY);
        prescriptionRepository.save(p);

        // Notify patient
        notificationPublisher.publish(NotificationEvent.push(
                p.getPatient().getUserId(), "prescription.ready",
                "Your medication is packaged and awaiting pickup by a delivery biker.",
                Map.of("prescriptionId", p.getPrescriptionId().toString())));

        log.info("Prescription {} marked READY_FOR_DELIVERY by pharmacist={}", prescriptionId, pharmacistUserId);
        return PrescriptionDto.from(p);
    }

    // ── Biker assignment ──────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public DeliveryDto assignBiker(UUID prescriptionId, UUID pharmacistUserId, AssignBikerRequest req) {
        Prescription p = getAndValidatePrescription(prescriptionId, pharmacistUserId);
        if (p.getStatus() != PrescriptionStatus.READY_FOR_DELIVERY) {
            throw AppException.badRequest(
                    "Prescription must be READY_FOR_DELIVERY before assigning a biker. Current: " + p.getStatus());
        }

        Biker biker = bikerRepository.findById(req.bikerId())
                .orElseThrow(() -> AppException.notFound("Biker not found"));

        // Verify biker belongs to same pharmacy
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        if (!biker.getPharmacy().getPharmacyId().equals(pharmacist.getPharmacy().getPharmacyId())) {
            throw AppException.forbidden("Biker does not belong to your pharmacy");
        }
        if (biker.getStatus() != BikerStatus.AVAILABLE) {
            throw AppException.badRequest("Biker is not available. Current status: " + biker.getStatus());
        }

        // Create delivery record
        Delivery delivery = new Delivery();
        delivery.setPrescription(p);
        delivery.setBiker(biker);
        delivery.setStatus(DeliveryStatus.ASSIGNED);
        delivery.setAssignedAt(OffsetDateTime.now());
        Delivery saved = deliveryRepository.save(delivery);

        // Mark biker as on delivery
        biker.setStatus(BikerStatus.ON_DELIVERY);
        bikerRepository.save(biker);

        // Notify biker
        notificationPublisher.publish(NotificationEvent.push(
                biker.getUserId(), "delivery.assigned",
                "You have been assigned a new delivery. Please accept or decline.",
                Map.of("deliveryId",      saved.getDeliveryId().toString(),
                       "prescriptionId",  p.getPrescriptionId().toString(),
                       "patientName",     p.getPatient().getUser().getName(),
                       "deliveryAddress", p.getDeliveryAddress() != null ? p.getDeliveryAddress() : "")));

        log.info("Delivery {} assigned: prescription={} biker={}", saved.getDeliveryId(), prescriptionId, req.bikerId());
        return DeliveryDto.from(saved);
    }

    // ── Reassign biker (after decline/failure) ────────────────────────────────

    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public DeliveryDto reassignBiker(UUID deliveryId, UUID pharmacistUserId, AssignBikerRequest req) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> AppException.notFound("Delivery not found"));

        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        if (!delivery.getPrescription().getPharmacy().getPharmacyId()
                .equals(pharmacist.getPharmacy().getPharmacyId())) {
            throw AppException.forbidden("This delivery does not belong to your pharmacy");
        }
        if (delivery.getStatus() != DeliveryStatus.DECLINED && delivery.getStatus() != DeliveryStatus.FAILED) {
            throw AppException.badRequest("Can only reassign DECLINED or FAILED deliveries");
        }

        // Free previous biker
        if (delivery.getBiker() != null) {
            Biker old = delivery.getBiker();
            old.setStatus(BikerStatus.AVAILABLE);
            bikerRepository.save(old);
        }

        Biker newBiker = bikerRepository.findById(req.bikerId())
                .orElseThrow(() -> AppException.notFound("Biker not found"));
        if (!newBiker.getPharmacy().getPharmacyId().equals(pharmacist.getPharmacy().getPharmacyId())) {
            throw AppException.forbidden("Biker does not belong to your pharmacy");
        }
        if (newBiker.getStatus() != BikerStatus.AVAILABLE) {
            throw AppException.badRequest("Biker is not available. Current status: " + newBiker.getStatus());
        }

        delivery.setBiker(newBiker);
        delivery.setStatus(DeliveryStatus.ASSIGNED);
        delivery.setAssignedAt(OffsetDateTime.now());
        delivery.setAcceptedAt(null);
        delivery.setPickedUpAt(null);
        delivery.setDeliveredAt(null);
        delivery.setFailureReason(null);
        Delivery saved = deliveryRepository.save(delivery);

        newBiker.setStatus(BikerStatus.ON_DELIVERY);
        bikerRepository.save(newBiker);

        notificationPublisher.publish(NotificationEvent.push(
                newBiker.getUserId(), "delivery.assigned",
                "You have been assigned a new delivery. Please accept or decline.",
                Map.of("deliveryId", saved.getDeliveryId().toString())));

        log.info("Delivery {} reassigned to biker={}", deliveryId, req.bikerId());
        return DeliveryDto.from(saved);
    }

    // ── Get deliveries for my pharmacy ────────────────────────────────────────

    @PreAuthorize("hasRole('PHARMACIST')")
    public List<DeliveryDto> getMyDeliveries(UUID pharmacistUserId) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        return deliveryRepository
                .findAllByPrescription_Pharmacy_PharmacyIdOrderByCreatedAtDesc(
                        pharmacist.getPharmacy().getPharmacyId())
                .stream().map(DeliveryDto::from).toList();
    }

    // ── Biker management ──────────────────────────────────────────────────────

    @PreAuthorize("hasRole('PHARMACIST')")
    public List<BikerDto> getMyBikers(UUID pharmacistUserId) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        return bikerRepository.findAllByPharmacy_PharmacyId(pharmacist.getPharmacy().getPharmacyId())
                .stream().map(BikerDto::from).toList();
    }

    /**
     * Returns AVAILABLE bikers for a specific prescription, sorted so that bikers
     * whose operating zone covers the delivery district appear first.
     * Used by the pharmacist UI to pre-rank the biker picker.
     */
    @PreAuthorize("hasRole('PHARMACIST')")
    public List<BikerDto> getSuggestedBikers(UUID prescriptionId, UUID pharmacistUserId) {
        Prescription p = getAndValidatePrescription(prescriptionId, pharmacistUserId);
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);

        String district = p.getDeliveryDistrict() != null ? p.getDeliveryDistrict() : "";
        List<Biker> bikers = bikerRepository.findAvailableSortedByZone(
                pharmacist.getPharmacy().getPharmacyId(), district);

        return bikers.stream().map(BikerDto::from).toList();
    }

    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public BikerDto registerBiker(UUID pharmacistUserId, RegisterBikerRequest req) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);

        if (userRepository.existsByEmail(req.email())) {
            throw AppException.conflict("Email address is already registered");
        }

        String tempPassword = generateTempPassword();

        User user = new User();
        user.setName(req.name());
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setRole(Role.BIKER);
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setVerified(true); // pharmacist-registered bikers are pre-verified
        userRepository.save(user);

        Biker biker = new Biker();
        biker.setUser(user);
        biker.setPharmacy(pharmacist.getPharmacy());
        biker.setLicenseNumber(req.licenseNumber());
        biker.setVehicleType(req.vehicleType());
        biker.setOperatingZone(req.operatingZone());
        bikerRepository.save(biker);

        // Send credentials via email.
        // Pre-enrich so the async publisher skips the DB lookup — the user row may not
        // be visible to other sessions until after this transaction commits.
        String credentialsMsg = "Welcome to SHCP Delivery! Your login: Email: " + req.email() +
                " | Temp password: " + tempPassword + " | Please change it after first login.";
        Map<String, Object> meta = Map.of("pharmacyName", pharmacist.getPharmacy().getName());
        notificationPublisher.publish(
                NotificationEvent.email(user.getUserId(), "biker.registered", credentialsMsg, meta)
                        .withRecipient(user.getPhone(), user.getEmail(), null));

        log.info("Biker {} registered by pharmacist={} at pharmacy={} — temp password issued",
                user.getEmail(), pharmacistUserId, pharmacist.getPharmacy().getPharmacyId());
        return new BikerDto(
                user.getUserId(),
                pharmacist.getPharmacy().getPharmacyId(),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                biker.getLicenseNumber(),
                biker.getVehicleType(),
                biker.getOperatingZone(),
                biker.getStatus().name(),
                tempPassword
        );
    }

    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public BikerDto setBikerActive(UUID bikerId, UUID pharmacistUserId, boolean active) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        Biker biker = bikerRepository.findById(bikerId)
                .orElseThrow(() -> AppException.notFound("Biker not found"));
        if (!biker.getPharmacy().getPharmacyId().equals(pharmacist.getPharmacy().getPharmacyId())) {
            throw AppException.forbidden("Biker does not belong to your pharmacy");
        }
        biker.getUser().setVerified(active);
        userRepository.save(biker.getUser());
        if (active) {
            biker.setStatus(BikerStatus.AVAILABLE);
        } else {
            biker.setStatus(BikerStatus.OFFLINE);
        }
        bikerRepository.save(biker);
        log.info("Biker {} set active={} by pharmacist={}", bikerId, active, pharmacistUserId);
        return BikerDto.from(biker);
    }

    // ── Inventory management (Gap #1) ─────────────────────────────────────────

    /**
     * Returns all inventory items for the pharmacist's pharmacy,
     * with low-stock items first.
     */
    @PreAuthorize("hasRole('PHARMACIST')")
    public List<InventoryItemDto> getMyInventory(UUID pharmacistUserId) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        return inventoryRepository
                .findAllByPharmacy_PharmacyId(pharmacist.getPharmacy().getPharmacyId())
                .stream()
                .sorted(java.util.Comparator
                        .comparingInt(PharmacyInventory::getQuantityInStock))   // low stock first
                .map(InventoryItemDto::from)
                .toList();
    }

    /**
     * Upsert: creates a new inventory item or updates existing one
     * (matched by medication name, case-insensitive).
     */
    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public InventoryItemDto upsertStock(UUID pharmacistUserId, StockUpdateRequest req) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        UUID pharmacyId = pharmacist.getPharmacy().getPharmacyId();

        PharmacyInventory item = inventoryRepository
                .findByPharmacy_PharmacyIdAndMedicationNameIgnoreCase(pharmacyId, req.medicationName())
                .orElseGet(() -> {
                    PharmacyInventory newItem = new PharmacyInventory();
                    newItem.setPharmacy(pharmacist.getPharmacy());
                    newItem.setMedicationName(req.medicationName());
                    return newItem;
                });

        item.setGenericName(req.genericName());
        item.setQuantityInStock(req.quantityInStock());
        if (req.unit() != null && !req.unit().isBlank()) item.setUnit(req.unit());
        if (req.reorderLevel() != null) item.setReorderLevel(req.reorderLevel());
        if (req.expiryDate() != null && !req.expiryDate().isBlank()) {
            item.setExpiryDate(java.time.LocalDate.parse(req.expiryDate()));
        }

        PharmacyInventory saved = inventoryRepository.save(item);
        log.info("Inventory upserted: pharmacy={} medication='{}' qty={}",
                pharmacyId, req.medicationName(), req.quantityInStock());

        // Low-stock alert
        if (saved.getQuantityInStock() <= saved.getReorderLevel()) {
            log.warn("LOW STOCK: pharmacy={} '{}' qty={} <= reorderLevel={}",
                    pharmacyId, saved.getMedicationName(),
                    saved.getQuantityInStock(), saved.getReorderLevel());
        }

        return InventoryItemDto.from(saved);
    }

    @Transactional
    @PreAuthorize("hasRole('PHARMACIST')")
    public void deleteInventoryItem(UUID inventoryId, UUID pharmacistUserId) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        PharmacyInventory item = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> rw.shcp.common.exception.AppException.notFound("Inventory item not found"));
        if (!item.getPharmacy().getPharmacyId().equals(pharmacist.getPharmacy().getPharmacyId())) {
            throw rw.shcp.common.exception.AppException.forbidden("This inventory item does not belong to your pharmacy");
        }
        inventoryRepository.delete(item);
        log.info("Inventory item {} deleted by pharmacist={}", inventoryId, pharmacistUserId);
    }

    @PreAuthorize("hasRole('PHARMACIST')")
    public List<InventoryItemDto> getLowStockAlerts(UUID pharmacistUserId) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        return inventoryRepository.findLowStock(pharmacist.getPharmacy().getPharmacyId())
                .stream().map(InventoryItemDto::from).toList();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Prescription getAndValidatePrescription(UUID prescriptionId, UUID pharmacistUserId) {
        Pharmacist pharmacist = resolvePharmacist(pharmacistUserId);
        Prescription p = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> AppException.notFound("Prescription not found"));
        if (p.getPharmacy() == null ||
                !p.getPharmacy().getPharmacyId().equals(pharmacist.getPharmacy().getPharmacyId())) {
            throw AppException.forbidden("This prescription is not assigned to your pharmacy");
        }
        return p;
    }

    private void assertStatus(Prescription p, PrescriptionStatus expected, String action) {
        if (p.getStatus() != expected) {
            throw AppException.badRequest(
                    "Cannot " + action + ". Prescription status is " + p.getStatus() +
                    ", expected " + expected);
        }
    }

    private String generateTempPassword() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
        SecureRandom rng = new SecureRandom();
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) sb.append(chars.charAt(rng.nextInt(chars.length())));
        return sb.toString();
    }
}
