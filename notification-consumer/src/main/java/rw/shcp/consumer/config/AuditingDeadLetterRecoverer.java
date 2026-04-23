package rw.shcp.consumer.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.retry.MessageRecoverer;
import org.springframework.stereotype.Component;
import rw.shcp.consumer.entity.NotificationRecord;
import rw.shcp.consumer.entity.NotificationRecord.Status;
import rw.shcp.consumer.event.NotificationEvent;
import rw.shcp.consumer.repository.NotificationRecordRepository;

/**
 * Runs after all retry attempts are exhausted.
 * Persists a single {@link Status#DEAD_LETTERED} audit record and then
 * rejects the message (routes it to the DLQ) without requeuing.
 *
 * <p>This is the only place a failure record is written for transient
 * delivery errors, so the {@code notifications} table always has exactly
 * one row per logical delivery attempt: SENT on success, DEAD_LETTERED on
 * final failure.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditingDeadLetterRecoverer implements MessageRecoverer {

    private final NotificationRecordRepository recordRepository;
    private final ObjectMapper                 objectMapper;

    @Override
    public void recover(Message message, Throwable cause) {
        String queue = message.getMessageProperties().getConsumerQueue();

        try {
            NotificationEvent event = objectMapper.readValue(message.getBody(), NotificationEvent.class);

            NotificationRecord record = new NotificationRecord();
            record.setUserId(event.userId());
            record.setType(event.eventType());
            record.setChannel(channelFromQueue(queue));
            record.setMessage(event.message());
            record.setStatus(Status.DEAD_LETTERED);
            record.setRetryCount(3);
            record.setErrorDetail(cause.getMessage());
            recordRepository.save(record);

            log.warn("Message dead-lettered after 3 attempts: queue={} userId={} event={}",
                    queue, event.userId(), event.eventType());

        } catch (Exception e) {
            log.error("Failed to persist dead-letter audit record for queue={}: {}", queue, e.getMessage());
        }

        throw new AmqpRejectAndDontRequeueException("Retry policy exhausted: " + cause.getMessage(), cause);
    }

    private String channelFromQueue(String queue) {
        if (queue == null) return "UNKNOWN";
        if (queue.contains("email")) return "EMAIL";
        if (queue.contains("push"))  return "PUSH";
        return "UNKNOWN";
    }
}
