package rw.shcp.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PharmacyRepository extends JpaRepository<Pharmacy, UUID> {

    List<Pharmacy> findAllByIsActiveTrue();

    // ── Cascade matching: cell (most specific) ────────────────────────────────
    // Orders by least-loaded pharmacy first (fewest PENDING/PROCESSING prescriptions),
    // then by registration date as a stable tiebreaker.
    @Query(value = """
            SELECT p.* FROM pharmacies p
            WHERE LOWER(p.district) = LOWER(:district)
              AND LOWER(p.sector)   = LOWER(:sector)
              AND LOWER(p.cell)     = LOWER(:cell)
              AND p.is_active = true
            ORDER BY (
                SELECT COUNT(*) FROM prescriptions pr
                WHERE pr.pharmacy_id = p.pharmacy_id
                  AND pr.status IN ('PENDING', 'PROCESSING')
            ) ASC, p.created_at ASC
            """, nativeQuery = true)
    List<Pharmacy> findActiveByDistrictAndSectorAndCell(
            @Param("district") String district,
            @Param("sector")   String sector,
            @Param("cell")     String cell);

    // ── Sector level ──────────────────────────────────────────────────────────
    @Query(value = """
            SELECT p.* FROM pharmacies p
            WHERE LOWER(p.district) = LOWER(:district)
              AND LOWER(p.sector)   = LOWER(:sector)
              AND p.is_active = true
            ORDER BY (
                SELECT COUNT(*) FROM prescriptions pr
                WHERE pr.pharmacy_id = p.pharmacy_id
                  AND pr.status IN ('PENDING', 'PROCESSING')
            ) ASC, p.created_at ASC
            """, nativeQuery = true)
    List<Pharmacy> findActiveByDistrictAndSector(
            @Param("district") String district,
            @Param("sector")   String sector);

    // ── District level ────────────────────────────────────────────────────────
    @Query(value = """
            SELECT p.* FROM pharmacies p
            WHERE LOWER(p.district) = LOWER(:district)
              AND p.is_active = true
            ORDER BY (
                SELECT COUNT(*) FROM prescriptions pr
                WHERE pr.pharmacy_id = p.pharmacy_id
                  AND pr.status IN ('PENDING', 'PROCESSING')
            ) ASC, p.created_at ASC
            """, nativeQuery = true)
    List<Pharmacy> findActiveByDistrict(@Param("district") String district);

    // ── National fallback (least-loaded active pharmacy) ─────────────────────
    @Query(value = """
            SELECT p.* FROM pharmacies p
            WHERE p.is_active = true
            ORDER BY (
                SELECT COUNT(*) FROM prescriptions pr
                WHERE pr.pharmacy_id = p.pharmacy_id
                  AND pr.status IN ('PENDING', 'PROCESSING')
            ) ASC, p.created_at ASC
            """, nativeQuery = true)
    List<Pharmacy> findAllByIsActiveTrueSortedByLoad();
}
