package rw.shcp.consumer.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import rw.shcp.consumer.entity.NotificationRecord;

import java.util.UUID;

public interface NotificationRecordRepository extends JpaRepository<NotificationRecord, UUID> {}
