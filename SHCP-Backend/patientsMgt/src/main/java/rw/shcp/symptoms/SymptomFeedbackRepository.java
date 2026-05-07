package rw.shcp.symptoms;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SymptomFeedbackRepository extends JpaRepository<SymptomFeedback, UUID> {
    Optional<SymptomFeedback> findByReport(SymptomReport report);
    boolean existsByReport(SymptomReport report);
}
