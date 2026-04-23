package rw.shcp.pharmacy;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.common.util.HaversineUtils;
import rw.shcp.common.util.RwandaLocations;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.pharmacy.dto.AddPharmacistRequest;
import rw.shcp.pharmacy.dto.CreatePharmacyRequest;
import rw.shcp.pharmacy.dto.PharmacistProfileDto;
import rw.shcp.pharmacy.dto.PharmacyDto;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.UserRepository;

import java.security.SecureRandom;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class PharmacyService {

    private final PharmacyRepository          pharmacyRepository;
    private final PharmacyInventoryRepository inventoryRepository;
    private final PharmacistRepository        pharmacistRepository;
    private final UserRepository              userRepository;
    private final PasswordEncoder             passwordEncoder;
    private final NotificationPublisher       notificationPublisher;

    public List<PharmacyDto> listActive() {
        return pharmacyRepository.findAllByIsActiveTrue()
                .stream().map(PharmacyDto::from).toList();
    }

    public PharmacyDto getById(UUID pharmacyId) {
        return PharmacyDto.from(pharmacyRepository.findById(pharmacyId)
                .orElseThrow(() -> AppException.notFound("Pharmacy not found")));
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public PharmacyDto create(CreatePharmacyRequest req) {
        if (hasValue(req.district()) && !RwandaLocations.isKnownDistrict(req.district())) {
            log.warn("Creating pharmacy with unrecognised district '{}' — check for typos", req.district());
        }
        Pharmacy pharmacy = new Pharmacy();
        applyRequest(pharmacy, req);
        Pharmacy saved = pharmacyRepository.save(pharmacy);
        log.info("Pharmacy created: {} [{}/{}/{}] GPS={}/{}",
                saved.getPharmacyId(), saved.getDistrict(), saved.getSector(), saved.getCell(),
                saved.getLatitude(), saved.getLongitude());
        return PharmacyDto.from(saved);
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public PharmacyDto update(UUID pharmacyId, CreatePharmacyRequest req) {
        Pharmacy pharmacy = pharmacyRepository.findById(pharmacyId)
                .orElseThrow(() -> AppException.notFound("Pharmacy not found"));
        if (hasValue(req.district()) && !RwandaLocations.isKnownDistrict(req.district())) {
            log.warn("Updating pharmacy {} with unrecognised district '{}'", pharmacyId, req.district());
        }
        applyRequest(pharmacy, req);
        return PharmacyDto.from(pharmacyRepository.save(pharmacy));
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public void setActive(UUID pharmacyId, boolean active) {
        Pharmacy pharmacy = pharmacyRepository.findById(pharmacyId)
                .orElseThrow(() -> AppException.notFound("Pharmacy not found"));
        pharmacy.setActive(active);
        pharmacyRepository.save(pharmacy);
        log.info("Pharmacy {} set active={}", pharmacyId, active);
    }

    // ── Pharmacist management (admin) ─────────────────────────────────────────

    @PreAuthorize("hasRole('ADMIN')")
    public List<PharmacistProfileDto> listPharmacists(UUID pharmacyId) {
        pharmacyRepository.findById(pharmacyId)
                .orElseThrow(() -> AppException.notFound("Pharmacy not found"));
        return pharmacistRepository.findAllByPharmacy_PharmacyId(pharmacyId)
                .stream().map(PharmacistProfileDto::from).toList();
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public PharmacistProfileDto addPharmacist(UUID pharmacyId, AddPharmacistRequest req) {
        Pharmacy pharmacy = pharmacyRepository.findById(pharmacyId)
                .orElseThrow(() -> AppException.notFound("Pharmacy not found"));

        if (userRepository.existsByEmail(req.email())) {
            throw AppException.conflict("Email address is already registered");
        }

        String tempPassword = generateTempPassword();

        User user = new User();
        user.setName(req.name());
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setRole(Role.PHARMACIST);
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setVerified(true); // admin-registered pharmacists are pre-verified
        userRepository.save(user);

        Pharmacist pharmacist = new Pharmacist();
        pharmacist.setUser(user);
        pharmacist.setPharmacy(pharmacy);
        pharmacistRepository.save(pharmacist);

        // Send credentials via email.
        // Pre-enrich the event with contact details so NotificationPublisher skips the
        // DB lookup — the async task can run before the transaction commits, at which
        // point the new user row may not yet be visible to other sessions.
        String msg = "Welcome to SHCP! Your pharmacist account is ready." +
                " Email: " + req.email() +
                " | Temporary password: " + tempPassword +
                " | Please log in and change your password immediately." +
                " | Pharmacy: " + pharmacy.getName();
        Map<String, Object> meta = Map.of("pharmacyName", pharmacy.getName());
        notificationPublisher.publish(
                NotificationEvent.email(user.getUserId(), "pharmacist.registered", msg, meta)
                        .withRecipient(user.getPhone(), user.getEmail(), null));

        log.info("Pharmacist {} registered at pharmacy={} by admin — temp password issued",
                req.email(), pharmacyId);
        // Build DTO from already-loaded objects to avoid lazy-proxy issues after @MapsId persist.
        // tempPassword is included so the admin can copy it for the pharmacist if email delivery fails.
        return new PharmacistProfileDto(
                user.getUserId(),
                user.getName(),
                user.getEmail(),
                user.getPhone(),
                pharmacy.getPharmacyId(),
                pharmacy.getName(),
                tempPassword
        );
    }

    private String generateTempPassword() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
        SecureRandom rng = new SecureRandom();
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) sb.append(chars.charAt(rng.nextInt(chars.length())));
        return sb.toString();
    }

    /**
     * Cascade nearest-pharmacy resolver with stock check and GPS tiebreaker.
     *
     * <p>Priority (most → least specific):
     * <ol>
     *   <li>Same district + sector + cell — filtered by stock — sorted by GPS distance then load</li>
     *   <li>Same district + sector</li>
     *   <li>Same district</li>
     *   <li>Any active pharmacy (national fallback)</li>
     * </ol>
     *
     * <p>At each level, pharmacies that have all requested medications in stock
     * are preferred. If none have full stock at any level, the cascade repeats
     * without the stock filter and a warning is logged.
     *
     * @param district      Rwanda district of the delivery address (validated; null = skip location matching)
     * @param sector        Rwanda sector (optional refinement)
     * @param cell          Rwanda cell (optional refinement)
     * @param deliveryLat   WGS-84 latitude of the delivery point (null = skip GPS tiebreaker)
     * @param deliveryLon   WGS-84 longitude of the delivery point
     * @param medNames      lower-cased medication names to check against inventory
     * @param excludeId     pharmacy ID to exclude (used by SLA re-routing; pass null normally)
     * @return best-matching active {@link Pharmacy}
     * @throws AppException (400) if no active pharmacy exists at all
     */
    public Pharmacy resolveNearest(
            String district, String sector, String cell,
            Double deliveryLat, Double deliveryLon,
            List<String> medNames,
            UUID excludeId) {

        // ── District validation (Gap #10) ─────────────────────────────────
        if (hasValue(district) && !RwandaLocations.isKnownDistrict(district)) {
            log.warn("resolveNearest: unrecognised district '{}' — falling back to sector/national cascade", district);
        }

        Pharmacy match = tryResolve(district, sector, cell, deliveryLat, deliveryLon, medNames, excludeId, true);
        if (match != null) return match;

        // No pharmacy with full stock found — retry without stock filter and warn
        log.warn("No pharmacy has all requested medications in stock. " +
                 "Assigning nearest pharmacy regardless of stock — pharmacist will need to source medications.");
        match = tryResolve(district, sector, cell, deliveryLat, deliveryLon, null, excludeId, false);
        if (match != null) return match;

        throw AppException.badRequest("No active pharmacy is available to fulfil this prescription");
    }

    /** Convenience overload for normal (non-SLA) prescription issue. */
    public Pharmacy resolveNearest(String district, String sector, String cell,
                                   Double deliveryLat, Double deliveryLon,
                                   List<String> medNames) {
        return resolveNearest(district, sector, cell, deliveryLat, deliveryLon, medNames, null);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Runs the four-level cascade and returns the first match, or null if none.
     *
     * @param withStockFilter if true, only consider pharmacies that have all meds in stock
     * @param stockWarning    whether to emit a warning on a stock-filter miss (only on first pass)
     */
    private Pharmacy tryResolve(String district, String sector, String cell,
                                Double deliveryLat, Double deliveryLon,
                                List<String> medNames, UUID excludeId,
                                boolean stockWarning) {

        if (hasValue(district) && hasValue(sector) && hasValue(cell)) {
            List<Pharmacy> candidates = pharmacyRepository.findActiveByDistrictAndSectorAndCell(district, sector, cell);
            Pharmacy pick = pickBest(candidates, deliveryLat, deliveryLon, medNames, excludeId);
            if (pick != null) {
                log.debug("Pharmacy matched at cell level: {}/{}/{}", district, sector, cell);
                return pick;
            }
        }
        if (hasValue(district) && hasValue(sector)) {
            List<Pharmacy> candidates = pharmacyRepository.findActiveByDistrictAndSector(district, sector);
            Pharmacy pick = pickBest(candidates, deliveryLat, deliveryLon, medNames, excludeId);
            if (pick != null) {
                log.debug("Pharmacy matched at sector level: {}/{}", district, sector);
                return pick;
            }
        }
        if (hasValue(district)) {
            List<Pharmacy> candidates = pharmacyRepository.findActiveByDistrict(district);
            Pharmacy pick = pickBest(candidates, deliveryLat, deliveryLon, medNames, excludeId);
            if (pick != null) {
                log.debug("Pharmacy matched at district level: {}", district);
                return pick;
            }
        }
        log.debug("No location-specific pharmacy found — using national fallback (least loaded)");
        List<Pharmacy> allActive = pharmacyRepository.findAllByIsActiveTrueSortedByLoad();
        return pickBest(allActive, deliveryLat, deliveryLon, medNames, excludeId);
    }

    /**
     * From a candidate list (already load-sorted by the SQL query), apply:
     * 1. Exclude the given pharmacy ID (for SLA re-routing)
     * 2. Stock filter (if medNames provided)
     * 3. GPS re-sort (if delivery coordinates and pharmacy coordinates are available)
     * 4. Return the first element, or null if the list is empty after filtering
     */
    private Pharmacy pickBest(List<Pharmacy> candidates, Double deliveryLat, Double deliveryLon,
                              List<String> medNames, UUID excludeId) {
        List<Pharmacy> filtered = candidates.stream()
                .filter(p -> excludeId == null || !p.getPharmacyId().equals(excludeId))
                .filter(p -> hasStock(p.getPharmacyId(), medNames))
                .toList();

        if (filtered.isEmpty()) return null;

        // Re-sort by GPS distance if all relevant coordinates are present
        if (deliveryLat != null && deliveryLon != null) {
            filtered = filtered.stream()
                    .sorted(Comparator.comparingDouble(p -> {
                        if (p.getLatitude() == null || p.getLongitude() == null)
                            return Double.MAX_VALUE; // pharmacies without GPS go last
                        return HaversineUtils.distanceKm(deliveryLat, deliveryLon,
                                p.getLatitude(), p.getLongitude());
                    }))
                    .toList();
        }

        return filtered.get(0);
    }

    /** Returns true when the pharmacy has all medNames in stock, or medNames is null/empty. */
    private boolean hasStock(UUID pharmacyId, List<String> medNames) {
        if (medNames == null || medNames.isEmpty()) return true;
        long inStock = inventoryRepository.countMedicationsInStock(pharmacyId, medNames);
        return inStock >= medNames.size();
    }

    private void applyRequest(Pharmacy pharmacy, CreatePharmacyRequest req) {
        pharmacy.setName(req.name());
        pharmacy.setAddress(req.address());
        pharmacy.setDistrict(req.district());
        pharmacy.setSector(req.sector());
        pharmacy.setCell(req.cell());
        pharmacy.setLatitude(req.latitude());
        pharmacy.setLongitude(req.longitude());
        pharmacy.setPhone(req.phone());
        pharmacy.setEmail(req.email());
    }

    private static boolean hasValue(String s) {
        return s != null && !s.isBlank();
    }
}
