package rw.shcp.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyInventoryRepository extends JpaRepository<PharmacyInventory, UUID> {

    List<PharmacyInventory> findAllByPharmacy_PharmacyId(UUID pharmacyId);

    Optional<PharmacyInventory> findByPharmacy_PharmacyIdAndMedicationNameIgnoreCase(
            UUID pharmacyId, String medicationName);

    /**
     * Counts how many of the requested medication names are in stock (qty > 0)
     * at the given pharmacy. Used to decide whether a pharmacy can fulfil all
     * prescribed medications before assigning it.
     *
     * @param pharmacyId pharmacy to check
     * @param names      lower-cased medication names (must match {@code LOWER(medicationName)})
     * @return number of names found in stock; compare to {@code names.size()} for full match
     */
    @Query("""
            SELECT COUNT(DISTINCT LOWER(pi.medicationName))
            FROM PharmacyInventory pi
            WHERE pi.pharmacy.pharmacyId = :pharmacyId
              AND LOWER(pi.medicationName) IN :names
              AND pi.quantityInStock > 0
            """)
    long countMedicationsInStock(
            @Param("pharmacyId") UUID pharmacyId,
            @Param("names")      List<String> names);

    /** Items at or below their reorder level — used by the low-stock alert. */
    @Query("""
            SELECT pi FROM PharmacyInventory pi
            WHERE pi.pharmacy.pharmacyId = :pharmacyId
              AND pi.quantityInStock <= pi.reorderLevel
            ORDER BY pi.quantityInStock ASC
            """)
    List<PharmacyInventory> findLowStock(@Param("pharmacyId") UUID pharmacyId);
}
