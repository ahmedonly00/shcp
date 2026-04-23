package rw.shcp.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import rw.shcp.common.enums.DeliveryStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryRepository extends JpaRepository<Delivery, UUID> {
    Optional<Delivery> findByPrescription_PrescriptionId(UUID prescriptionId);
    List<Delivery> findAllByBiker_UserIdOrderByCreatedAtDesc(UUID bikerId);
    List<Delivery> findAllByPrescription_Pharmacy_PharmacyIdOrderByCreatedAtDesc(UUID pharmacyId);
    /** Returns the most recently created active delivery for a given patient, if any. */
    Optional<Delivery> findFirstByPrescription_Patient_UserIdAndStatusInOrderByCreatedAtDesc(
            UUID patientUserId, Collection<DeliveryStatus> statuses);
}
