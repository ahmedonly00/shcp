package rw.shcp.consumer.provider;

import com.google.firebase.messaging.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@Slf4j
public class FcmPushProvider implements PushProvider {

    @Autowired(required = false)
    @Nullable
    private FirebaseMessaging firebaseMessaging;

    @Override
    public void send(String deviceToken, String title, String body, Map<String, String> data) {
        if (firebaseMessaging == null) {
            throw new NotificationDeliveryException("FCM is not configured — push notification not delivered");
        }
        Message.Builder builder = Message.builder()
                .setToken(deviceToken)
                .setNotification(Notification.builder()
                        .setTitle(title).setBody(body).build());
        if (data != null && !data.isEmpty()) {
            builder.putAllData(data);
        }
        try {
            String id = firebaseMessaging.send(builder.build());
            log.debug("FCM push sent: messageId={}", id);
        } catch (FirebaseMessagingException e) {
            throw new NotificationDeliveryException("FCM send failed: " + e.getMessage(), e);
        }
    }
}
