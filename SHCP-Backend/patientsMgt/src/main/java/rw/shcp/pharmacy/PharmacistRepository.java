package rw.shcp.pharmacy;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacistRepository extends JpaRepository<Pharmacist, UUID> {
    Optional<Pharmacist> findByUser_UserId(UUID userId);

    @EntityGraph(attributePaths = {"user", "pharmacy"})
    List<Pharmacist> findAllByPharmacy_PharmacyId(UUID pharmacyId);
}
