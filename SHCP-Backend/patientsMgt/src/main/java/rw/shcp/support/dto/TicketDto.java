package rw.shcp.support.dto;

import rw.shcp.support.SupportTicket;

import java.time.OffsetDateTime;
import java.util.UUID;

public record TicketDto(
        UUID           ticketId,
        String         subject,
        String         priority,
        String         status,
        OffsetDateTime createdAt
) {
    public static TicketDto from(SupportTicket t) {
        return new TicketDto(
                t.getTicketId(),
                t.getSubject(),
                t.getPriority().name(),
                t.getStatus().name(),
                t.getCreatedAt());
    }
}
