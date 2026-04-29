package rw.shcp.consumer.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.Nullable;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

@Configuration
@Slf4j
public class FcmConfig {

    @Value("${shcp.fcm.credentials-base64:}")
    private String credentialsBase64;

    @Value("${shcp.fcm.credentials-path:/run/secrets/fcm-credentials.json}")
    private String credentialsPath;

    @Bean
    @Nullable
    public FirebaseApp firebaseApp() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        try (InputStream is = openCredentialsStream()) {
            if (is == null) {
                log.warn("FCM credentials not configured — push notifications disabled. " +
                         "Set FCM_CREDENTIALS_BASE64 or FCM_CREDENTIALS_PATH to enable them.");
                return null;
            }
            GoogleCredentials credentials = GoogleCredentials.fromStream(is);
            FirebaseApp app = FirebaseApp.initializeApp(
                    FirebaseOptions.builder().setCredentials(credentials).build());
            log.info("Firebase Admin SDK initialised");
            return app;
        } catch (Exception e) {
            log.warn("Failed to initialise Firebase — push notifications disabled: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Returns null when Firebase failed to initialise, allowing the application
     * to start without push-notification support. FcmPushProvider guards against
     * a null FirebaseMessaging via @Autowired(required = false).
     */
    @Bean
    @Nullable
    public FirebaseMessaging firebaseMessaging() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {
                log.warn("FirebaseApp not initialised — FirebaseMessaging bean will be null.");
                return null;
            }
            return FirebaseMessaging.getInstance();
        } catch (Exception e) {
            log.warn("Failed to obtain FirebaseMessaging instance — push notifications disabled: {}",
                     e.getMessage());
            return null;
        }
    }

    private InputStream openCredentialsStream() throws IOException {
        if (StringUtils.hasText(credentialsBase64)) {
            byte[] decoded = Base64.getMimeDecoder().decode(credentialsBase64.trim());
            String json = new String(decoded).replace("\\n", "\n");
            return new ByteArrayInputStream(json.getBytes());
        }
        java.io.File file = new java.io.File(credentialsPath);
        if (file.exists()) {
            return new FileInputStream(file);
        }
        return null;
    }
}
