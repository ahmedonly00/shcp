package rw.shcp.prescriptions;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import rw.shcp.common.enums.PrescriptionStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {

    List<Prescription> findByPatient_UserIdOrderByIssuedAtDesc(UUID patientUserId);

    List<Prescription> findByProvider_UserIdOrderByIssuedAtDesc(UUID providerUserId);

    List<Prescription> findByConsultation_ConsultationIdOrderByIssuedAtDesc(UUID consultationId);

    List<Prescription> findByPatient_UserIdAndStatus(UUID patientUserId, PrescriptionStatus status);

    List<Prescription> findByPharmacy_PharmacyIdOrderByCreatedAtDesc(UUID pharmacyId);

    /**
     * Finds PENDING prescriptions assigned to a pharmacy that have not been
     * acknowledged within the SLA threshold — used by {@code PrescriptionSlaJob}.
     */
    @Query("""
            SELECT p FROM Prescription p
            WHERE p.status = :status
              AND p.createdAt < :threshold
              AND p.pharmacy IS NOT NULL
            ORDER BY p.createdAt ASC
            """)
    List<Prescription> findStalePending(
            @Param("status")    PrescriptionStatus status,
            @Param("threshold") OffsetDateTime threshold);
}
