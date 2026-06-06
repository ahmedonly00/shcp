package rw.shcp.pharmacy;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.enums.DeliveryStatus;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.pharmacy.dto.DeliveryDto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliveryTrackingService {

    private final DeliveryRepository deliveryRepository;

    /** Statuses that represent a delivery the patient should be able to see — includes
     *  terminal failure states so the patient is not left with a silently-vanished card. */
    private static final List<DeliveryStatus> TRACKABLE = List.of(
            DeliveryStatus.ASSIGNED,
            DeliveryStatus.ACCEPTED,
            DeliveryStatus.PICKED_UP,
            DeliveryStatus.ON_THE_WAY,
            DeliveryStatus.FAILED,
            DeliveryStatus.DECLINED);

    // ── Patient: get their current active delivery ─────────────────────────────

    @PreAuthorize("hasRole('PATIENT')")
    public Optional<DeliveryDto> getActiveDeliveryForPatient(UUID patientUserId) {
        return deliveryRepository
                .findFirstByPrescription_Patient_UserIdAndStatusInOrderByCreatedAtDesc(
                        patientUserId, TRACKABLE)
                .map(DeliveryDto::from);
    }

    // ── Shared: get full tracking info for a specific delivery ────────────────

    @PreAuthorize("hasAnyRole('PATIENT', 'PHARMACIST', 'ADMIN')")
    public DeliveryDto getTracking(UUID deliveryId, UUID currentUserId, Role role) {
        Delivery delivery = deliveryRepository.findById(deliveryId)
                .orElseThrow(() -> AppException.notFound("Delivery not found"));
        if (role == Role.PATIENT &&
                !delivery.getPrescription().getPatient().getUserId().equals(currentUserId)) {
            throw AppException.forbidden("You do not have access to this delivery");
        }
        return DeliveryDto.from(delivery);
    }
}
