package rw.shcp.consumer.event;

import java.util.Map;
import java.util.UUID;

/**
 * Mirror of the core API's NotificationEvent record.
 *
 * <p>
 * Must stay structurally identical to the record published by the core API
 * so Jackson can deserialize the RabbitMQ message payload correctly.
 * All recipient contact details are pre-populated by the publisher —
 * this service never needs to query the user database for contact info.
 * </p>
 */
public record NotificationEvent(
                String eventType,
                String channel,
                UUID userId,
                String message,
                Map<String, Object> metadata,
                String timestamp,
                String recipientPhone,
                String recipientEmail,
                String recipientDeviceToken) {
}
