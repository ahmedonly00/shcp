package rw.shcp.consumer.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Audit record written by each consumer after delivery attempt.
 * Maps to the same {@code notifications} table as the core API.
 */
@Entity
@Table(name = "notifications")
@Getter @Setter @NoArgsConstructor
public class NotificationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "notification_id", updatable = false, nullable = false)
    private UUID notificationId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "type", nullable = false, length = 50)
    private String type;

    @Column(name = "channel", nullable = false, length = 10)
    private String channel;

    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "retry_count", nullable = false)
    private int retryCount = 0;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;

    @Column(name = "error_detail", columnDefinition = "TEXT")
    private String errorDetail;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public enum Status { PENDING, SENT, FAILED, DEAD_LETTERED }
}
