package rw.shcp.analytics;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MohReportConfigRepository extends JpaRepository<MohReportConfig, UUID> {
    /** Always returns the first (and only) config row. */
    Optional<MohReportConfig> findFirstByOrderByCreatedAtAsc();
}
