package rw.shcp.referrals;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ReferralRepository extends JpaRepository<Referral, UUID> {
    List<Referral> findByPatient_UserIdOrderByCreatedAtDesc(UUID patientId);
    List<Referral> findByReferringProvider_UserIdOrderByCreatedAtDesc(UUID providerId);
    List<Referral> findBySpecialist_UserIdAndStatusOrderByCreatedAtDesc(UUID specialistId, String status);
}
