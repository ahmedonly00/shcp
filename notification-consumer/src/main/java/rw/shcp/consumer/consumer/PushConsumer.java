package rw.shcp.consumer.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import rw.shcp.consumer.config.RabbitMQConfig;
import rw.shcp.consumer.entity.NotificationRecord;
import rw.shcp.consumer.entity.NotificationRecord.Status;
import rw.shcp.consumer.event.NotificationEvent;
import rw.shcp.consumer.provider.NotificationDeliveryException;
import rw.shcp.consumer.provider.PushProvider;
import rw.shcp.consumer.repository.NotificationRecordRepository;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class PushConsumer {

    private final PushProvider                 pushProvider;
    private final NotificationRecordRepository recordRepository;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_PUSH)
    public void consume(NotificationEvent event) {
        log.info("Push consumer: event={} userId={}", event.eventType(), event.userId());

        String token = event.recipientDeviceToken();
        if (token == null || token.isBlank()) {
            // No device token — user hasn't registered a device.
            // Permanent skip (no retry); ack the message.
            recordRepository.save(buildRecord(event, "PUSH", Status.FAILED,
                    "No device token in event payload", null));
            log.debug("Push skipped — no device token for userId={}", event.userId());
            return;
        }

        String title = deriveTitle(event.eventType());
        Map<String, String> data = stringifyMetadata(event.metadata());

        try {
            pushProvider.send(token, title, event.message(), data);
        } catch (NotificationDeliveryException e) {
            // Transient failure — re-throw so the retry interceptor retries.
            // AuditingDeadLetterRecoverer persists the DEAD_LETTERED record after
            // all attempts are exhausted; no record is saved here.
            log.error("Push delivery failed userId={} event={}: {}", event.userId(), event.eventType(), e.getMessage());
            throw e;
        }

        recordRepository.save(buildRecord(event, "PUSH", Status.SENT, null, OffsetDateTime.now()));
        log.info("Push sent userId={} event={}", event.userId(), event.eventType());
    }

    static String deriveTitle(String eventType) {
        if (eventType == null) return "SHCP";
        return switch (eventType) {
            case "appointment.confirmed"        -> "Appointment Confirmed";
            case "appointment.reminder.24h"    -> "Appointment Tomorrow";
            case "appointment.reminder.1h"     -> "Appointment in 1 Hour";
            case "appointment.expired"         -> "Appointment Expired";
            case "consultation.started"        -> "Consultation Started";
            case "consultation.completed"      -> "Consultation Completed";
            case "prescription.issued"         -> "New Prescription";
            case "prescription.incoming"       -> "New Prescription Order";
            case "prescription.sla_reassigned" -> "Urgent: Prescription Reassigned";
            case "prescription.no_pharmacy"    -> "No Pharmacy Available";
            case "delivery.assigned"           -> "Delivery Assigned";
            case "delivery.picked_up"          -> "Prescription Picked Up";
            case "delivery.on_the_way"         -> "Medication On Its Way";
            case "delivery.delivered"          -> "Prescription Delivered";
            case "referral.created"            -> "Referral Created";
            case "referral.assigned"           -> "Referral Assigned to You";
            default                            -> "SHCP Notification";
        };
    }

    private Map<String, String> stringifyMetadata(Map<String, Object> metadata) {
        if (metadata == null) return Map.of();
        return metadata.entrySet().stream()
                .filter(e -> e.getValue() != null)
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().toString()));
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
