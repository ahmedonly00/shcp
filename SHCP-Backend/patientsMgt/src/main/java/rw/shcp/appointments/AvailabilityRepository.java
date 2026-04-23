package rw.shcp.appointments;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AvailabilityRepository extends JpaRepository<Availability, UUID> {

    /** Public: unbooked future slots for a given provider. */
    List<Availability> findByProviderUserIdAndIsBookedFalseAndStartTimeAfter(
            UUID providerId, OffsetDateTime from);

    /** Unbooked slots for a provider within a time window (used for date-filtered availability). */
    List<Availability> findByProviderUserIdAndIsBookedFalseAndStartTimeBetween(
            UUID providerId, OffsetDateTime from, OffsetDateTime to);

    /** All slots (booked + unbooked) for a provider — used by provider dashboard. */
    List<Availability> findByProviderUserId(UUID providerId);

    /**
     * Removes all future, non-booked slots for a provider.
     * Used during a full availability replacement ({@code PUT /me/availability}).
     */
    @Modifying
    @Query("DELETE FROM Availability a WHERE a.provider.userId = :providerId " +
           "AND a.isBooked = false AND a.startTime > :now")
    void deleteFutureUnbookedByProviderId(@Param("providerId") UUID providerId,
                                          @Param("now") OffsetDateTime now);

    /**
     * Public slot search with optional filters.
     * Pass {@code null} for any filter to skip it.
     * {@code from/to} define a time window; for "any future date" pass
     * {@code from = now} and {@code to = far future}.
     */
    @Query("SELECT a FROM Availability a " +
           "JOIN FETCH a.provider p " +
           "JOIN FETCH p.user u " +
           "WHERE a.isBooked = false " +
           "AND a.startTime >= :from " +
           "AND a.startTime < :to " +
           "AND (:specialty IS NULL OR p.specialty = :specialty) " +
           "AND (:language IS NULL OR u.languagePref = :language) " +
           "AND (:type IS NULL OR CAST(a.appointmentType AS string) = :type) " +
           "AND p.isActive = true " +
           "ORDER BY a.startTime ASC")
    List<Availability> searchAvailableSlots(
            @Param("from")      OffsetDateTime from,
            @Param("to")        OffsetDateTime to,
            @Param("specialty") String specialty,
            @Param("language")  String language,
            @Param("type")      String type);
}
