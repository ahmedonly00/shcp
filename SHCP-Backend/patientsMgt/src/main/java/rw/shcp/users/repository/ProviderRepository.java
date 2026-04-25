package rw.shcp.users.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import rw.shcp.users.model.Provider;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProviderRepository extends JpaRepository<Provider, UUID> {

    List<Provider> findByIsAvailableForInstantTrueAndIsActiveTrue();

    /** Atomically claims the instant slot — returns 1 if claimed, 0 if already taken. */
    @Modifying
    @Query("UPDATE Provider p SET p.isAvailableForInstant = false " +
           "WHERE p.userId = :providerId AND p.isAvailableForInstant = true")
    int claimInstantSlot(@Param("providerId") UUID providerId);

    /** Releases the instant slot after a consultation ends so the provider becomes available again. */
    @Modifying
    @Query("UPDATE Provider p SET p.isAvailableForInstant = true WHERE p.userId = :providerId")
    void releaseInstantSlot(@Param("providerId") UUID providerId);
}
