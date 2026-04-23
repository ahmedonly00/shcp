package rw.shcp.symptoms;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SymptomReportRepository extends JpaRepository<SymptomReport, UUID> {

    Page<SymptomReport> findByPatientUserId(UUID patientId, Pageable pageable);

    Optional<SymptomReport> findByReportIdAndPatientUserId(UUID reportId, UUID patientId);

    boolean existsByPatientUserId(UUID patientId);
}
