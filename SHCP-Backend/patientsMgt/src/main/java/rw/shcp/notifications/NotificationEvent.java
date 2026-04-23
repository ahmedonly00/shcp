package rw.shcp.notifications;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Payload published to the RabbitMQ topic exchange.
 *
 * <p>Routing key pattern: {@code notification.<channel>.<eventType>}<br>
 * e.g. {@code notification.email.appointment.confirmed}</p>
 *
 * <p>The publisher enriches each event with recipient contact details
 * ({@code recipientPhone}, {@code recipientEmail}, {@code recipientDeviceToken})
 * before sending. This makes the notification-consumer completely self-contained —
 * it never needs to query the user database.</p>
 */
public record NotificationEvent(
        String              eventType,
        String              channel,
        UUID                userId,
        String              message,
        Map<String, Object> metadata,
        String              timestamp,
        // Enriched by NotificationPublisher before sending
        String              recipientPhone,
        String              recipientEmail,
        String              recipientDeviceToken
) {
    public static NotificationEvent email(UUID userId, String eventType,
                                          String message, Map<String, Object> meta) {
        return new NotificationEvent(eventType, "email", userId, message, meta,
                Instant.now().toString(), null, null, null);
    }

    public static NotificationEvent push(UUID userId, String eventType,
                                         String message, Map<String, Object> meta) {
        return new NotificationEvent(eventType, "push", userId, message, meta,
                Instant.now().toString(), null, null, null);
    }

    /** Returns a copy with recipient contact details attached. */
    public NotificationEvent withRecipient(String phone, String email, String deviceToken) {
        return new NotificationEvent(
                eventType, channel, userId, message, metadata, timestamp,
                phone, email, deviceToken);
    }

    public String routingKey() {
        return "notification." + channel + "." + eventType;
    }
}
