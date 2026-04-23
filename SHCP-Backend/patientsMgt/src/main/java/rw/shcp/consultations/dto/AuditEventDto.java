package rw.shcp.consultations.dto;

import rw.shcp.consultations.ConsultationAuditEvent;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AuditEventDto(
        UUID   id,
        UUID   consultationId,
        String eventType,
        UUID   participantId,
        String participantRole,
        String metadata,
        OffsetDateTime createdAt
) {
    public static AuditEventDto from(ConsultationAuditEvent e) {
        return new AuditEventDto(
                e.getId(),
                e.getConsultationId(),
                e.getEventType(),
                e.getParticipantId(),
                e.getParticipantRole(),
                e.getMetadata(),
                e.getCreatedAt()
        );
    }
}
