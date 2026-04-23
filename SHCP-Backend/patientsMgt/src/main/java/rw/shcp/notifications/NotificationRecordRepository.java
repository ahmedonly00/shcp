package rw.shcp.notifications;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRecordRepository extends JpaRepository<NotificationRecord, UUID> {

    List<NotificationRecord> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<NotificationRecord> findByStatusOrderByCreatedAtAsc(
            NotificationRecord.NotificationStatus status);
}
