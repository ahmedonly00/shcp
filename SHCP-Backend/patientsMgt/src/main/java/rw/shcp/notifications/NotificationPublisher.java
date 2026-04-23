package rw.shcp.notifications;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import rw.shcp.users.repository.UserRepository;

/**
 * Enriches a {@link NotificationEvent} with recipient contact details then
 * publishes it to the {@code shcp.health.exchange} topic exchange.
 * The routing key {@code notification.<channel>.<eventType>} drives the
 * notification-consumer to the correct queue (sms / email / push).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationPublisher {

    private final UserRepository userRepository;
    private final RabbitTemplate rabbitTemplate;

    @Async
    public void publish(NotificationEvent event) {
        try {
            NotificationEvent enriched = userRepository.findById(event.userId())
                    .map(u -> event.withRecipient(u.getPhone(), u.getEmail(), u.getDeviceToken()))
                    .orElseGet(() -> {
                        log.warn("NotificationPublisher: user {} not found — publishing without contact details",
                                event.userId());
                        return event;
                    });

            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, enriched.routingKey(), enriched);

            log.debug("Published [{}] → {} for userId={}",
                    enriched.eventType(), enriched.routingKey(), enriched.userId());

        } catch (Exception e) {
            log.error("Failed to publish notification [{}] for userId={}: {}",
                    event.eventType(), event.userId(), e.getMessage());
        }
    }
}
