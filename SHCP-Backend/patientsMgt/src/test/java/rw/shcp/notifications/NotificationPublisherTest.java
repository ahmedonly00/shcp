package rw.shcp.notifications;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.UserRepository;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationPublisherTest {

    @Mock UserRepository  userRepository;
    @Mock RabbitTemplate  rabbitTemplate;

    @InjectMocks NotificationPublisher publisher;

    @Test
    void publish_shouldSendEmailWithCorrectRoutingKey() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user()));

        publisher.publish(NotificationEvent.email(userId, "prescription.issued",
                "New prescription", Map.of()));

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.EXCHANGE), keyCaptor.capture(), any(NotificationEvent.class));
        assertThat(keyCaptor.getValue()).isEqualTo("notification.email.prescription.issued");
    }

    @Test
    void publish_shouldSendPushWithCorrectRoutingKey() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user()));

        publisher.publish(NotificationEvent.push(userId, "consultation.started",
                "Consultation started", Map.of()));

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.EXCHANGE), keyCaptor.capture(), any(NotificationEvent.class));
        assertThat(keyCaptor.getValue()).isEqualTo("notification.push.consultation.started");
    }

    @Test
    void publish_shouldEnrichEventWithUserContactDetails() {
        UUID userId = UUID.randomUUID();
        User u = user();
        when(userRepository.findById(userId)).thenReturn(Optional.of(u));

        publisher.publish(NotificationEvent.push(userId, "test.event", "msg", Map.of()));

        ArgumentCaptor<NotificationEvent> eventCaptor = ArgumentCaptor.forClass(NotificationEvent.class);
        verify(rabbitTemplate).convertAndSend(any(), any(), eventCaptor.capture());
        NotificationEvent sent = eventCaptor.getValue();
        assertThat(sent.recipientPhone()).isEqualTo(u.getPhone());
        assertThat(sent.recipientEmail()).isEqualTo(u.getEmail());
    }

    @Test
    void publish_shouldSwallowExceptions_neverThrow() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user()));
        doThrow(new RuntimeException("broker down")).when(rabbitTemplate)
                .convertAndSend(any(String.class), any(String.class), any(Object.class));

        NotificationEvent event = NotificationEvent.email(userId, "test.event", "msg", Map.of());

        assertThatNoException().isThrownBy(() -> publisher.publish(event));
    }

    @Test
    void publish_shouldStillPublish_whenUserNotFound() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        publisher.publish(NotificationEvent.push(userId, "test.event", "msg", Map.of()));

        // still publishes — with null contact fields
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.EXCHANGE), anyString(), any(NotificationEvent.class));
    }

    private User user() {
        User u = new User();
        u.setEmail("test@shcp.rw");
        u.setPhone("+250780000001");
        u.setDeviceToken("fcm-token-abc");
        return u;
    }
}
