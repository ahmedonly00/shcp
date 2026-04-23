package rw.shcp.consultations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConsultationAuditEventRepository extends JpaRepository<ConsultationAuditEvent, UUID> {

    List<ConsultationAuditEvent> findByConsultationIdOrderByCreatedAtAsc(UUID consultationId);
}
