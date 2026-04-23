package rw.shcp.consumer.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import rw.shcp.consumer.config.RabbitMQConfig;
import rw.shcp.consumer.entity.NotificationRecord;
import rw.shcp.consumer.entity.NotificationRecord.Status;
import rw.shcp.consumer.event.NotificationEvent;
import rw.shcp.consumer.provider.EmailProvider;
import rw.shcp.consumer.provider.NotificationDeliveryException;
import rw.shcp.consumer.repository.NotificationRecordRepository;

import java.time.OffsetDateTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailConsumer {

    private final EmailProvider                emailProvider;
    private final NotificationRecordRepository recordRepository;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_EMAIL)
    public void consume(NotificationEvent event) {
        log.info("Email consumer: event={} userId={}", event.eventType(), event.userId());

        String email = event.recipientEmail();
        if (email == null || email.isBlank()) {
            // No address — permanent failure, ack immediately (no retry).
            recordRepository.save(buildRecord(event, "EMAIL", Status.FAILED,
                    "No email address in event payload", null));
            return;
        }

        String subject = deriveSubject(event.eventType());
        try {
            emailProvider.send(email, subject, event.message());
        } catch (NotificationDeliveryException e) {
            // Transient failure — re-throw so the retry interceptor retries.
            // AuditingDeadLetterRecoverer persists the DEAD_LETTERED record after
            // all attempts are exhausted; no record is saved here.
            log.error("Email delivery failed userId={} event={}: {}", event.userId(), event.eventType(), e.getMessage());
            throw e;
        }

        NotificationRecord record = buildRecord(event, "EMAIL", Status.SENT, null, OffsetDateTime.now());
        recordRepository.save(record);
        log.info("Email sent to {} event={}", email, event.eventType());
    }

    static String deriveSubject(String eventType) {
        if (eventType == null || eventType.isBlank()) return "SHCP Notification";
        String[] parts = eventType.split("\\.");
        StringBuilder sb = new StringBuilder("SHCP — ");
        for (String part : parts) {
            if (!part.isBlank()) {
                sb.append(Character.toUpperCase(part.charAt(0)))
                  .append(part.substring(1)).append(' ');
            }
        }
        return sb.toString().trim();
    }

    private NotificationRecord buildRecord(NotificationEvent event, String channel,
                                           Status status, String errorDetail,
                                           OffsetDateTime sentAt) {
        NotificationRecord r = new NotificationRecord();
        r.setUserId(event.userId());
        r.setType(event.eventType());
        r.setChannel(channel);
        r.setMessage(event.message());
        r.setStatus(status);
        r.setErrorDetail(errorDetail);
        r.setSentAt(sentAt);
        return r;
    }
}
