package rw.shcp.appointments;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WaitlistRepository extends JpaRepository<Waitlist, UUID> {

    List<Waitlist> findByPatient_UserIdOrderByCreatedAtDesc(UUID patientId);

    List<Waitlist> findByProvider_UserIdAndDateOrderByCreatedAtAsc(UUID providerId, LocalDate date);

    Optional<Waitlist> findByPatient_UserIdAndProvider_UserIdAndDate(
            UUID patientId, UUID providerId, LocalDate date);

    @Query("SELECT w FROM Waitlist w WHERE w.provider.userId = :providerId AND w.date = :date AND w.notified = false")
    List<Waitlist> findPendingByProviderAndDate(UUID providerId, LocalDate date);

    boolean existsByPatient_UserIdAndProvider_UserIdAndDate(UUID patientId, UUID providerId, LocalDate date);
}
