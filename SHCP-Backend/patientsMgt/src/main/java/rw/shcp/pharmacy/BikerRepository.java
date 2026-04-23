package rw.shcp.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import rw.shcp.common.enums.BikerStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BikerRepository extends JpaRepository<Biker, UUID> {

    List<Biker> findAllByPharmacy_PharmacyId(UUID pharmacyId);

    List<Biker> findAllByPharmacy_PharmacyIdAndStatus(UUID pharmacyId, BikerStatus status);

    Optional<Biker> findByUser_UserId(UUID userId);

    /**
     * Returns AVAILABLE bikers for the given pharmacy, sorted so that bikers whose
     * {@code operating_zone} contains the delivery district appear first.
     * Within each priority tier, bikers are ordered by {@code created_at ASC}
     * (earliest registered = longest-tenured = first offered work).
     *
     * @param pharmacyId the pharmacy the bikers belong to
     * @param district   the delivery district (case-insensitive LIKE match)
     */
    @Query(value = """
            SELECT b.* FROM bikers b
            JOIN users u ON u.user_id = b.user_id
            WHERE b.pharmacy_id = :pharmacyId
              AND b.status = 'AVAILABLE'
              AND u.is_verified = true
            ORDER BY
                CASE WHEN LOWER(b.operating_zone) LIKE LOWER(CONCAT('%', :district, '%')) THEN 0
                     ELSE 1
                END ASC,
                b.created_at ASC
            """, nativeQuery = true)
    List<Biker> findAvailableSortedByZone(
            @Param("pharmacyId") UUID pharmacyId,
            @Param("district")   String district);
}
