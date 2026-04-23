package rw.shcp.support;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.auth.EmailService;
import rw.shcp.support.dto.SubmitTicketRequest;
import rw.shcp.support.dto.TicketDto;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupportTicketService {

    private final SupportTicketRepository repository;
    private final EmailService            emailService;

    @Transactional
    public TicketDto submit(UUID userId, SubmitTicketRequest req) {
        SupportTicket ticket = new SupportTicket();
        ticket.setUserId(userId);
        ticket.setName(req.name());
        ticket.setEmail(req.email());
        ticket.setSubject(req.subject());
        ticket.setMessage(req.message());
        ticket.setPriority(req.priority() != null
                ? SupportTicket.Priority.valueOf(req.priority())
                : SupportTicket.Priority.LOW);

        SupportTicket saved = repository.save(ticket);
        log.info("Support ticket {} created by userId={} priority={}",
                saved.getTicketId(), userId, saved.getPriority());

        // Send confirmation email (non-blocking; failure is non-fatal)
        try {
            emailService.sendSupportTicketConfirmation(
                    req.email(), req.name(), saved.getTicketId(), req.subject());
        } catch (Exception e) {
            log.warn("Failed to send support ticket confirmation email: {}", e.getMessage());
        }

        return TicketDto.from(saved);
    }
}
