package rw.shcp.consultations;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Immutable record of a lifecycle event that occurred during a consultation.
 *
 * Events are written by both the backend (CALL_STARTED, CALL_ENDED) and the
 * authenticated frontend (JOINED, LEFT, RECORDING_STARTED, RECORDING_STOPPED,
 * SCREEN_SHARE_STARTED, SCREEN_SHARE_STOPPED, RECORDING_CONSENT_GIVEN).
 *
 * Rows are never updated or deleted — they form the tamper-evident audit trail
 * required for HIPAA compliance.
 */
@Entity
@Table(name = "consultation_audit_events")
@Getter
@Setter
@NoArgsConstructor
public class ConsultationAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "consultation_id", nullable = false, updatable = false)
    private UUID consultationId;

    @Column(name = "room_id", length = 100, updatable = false)
    private String roomId;

    /** Free-form event type string — see AuditEventTypes for constants. */
    @Column(name = "event_type", nullable = false, length = 50, updatable = false)
    private String eventType;

    @Column(name = "participant_id", updatable = false)
    private UUID participantId;

    @Column(name = "participant_role", length = 20, updatable = false)
    private String participantRole;

    @Column(name = "ip_address", length = 45, updatable = false)
    private String ipAddress;

    /** Optional JSON string with event-specific context. */
    @Column(name = "metadata", columnDefinition = "TEXT", updatable = false)
    private String metadata;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
