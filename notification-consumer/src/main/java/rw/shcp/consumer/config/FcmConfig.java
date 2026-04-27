package rw.shcp.consumer.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;
import java.util.Optional;

@Configuration
@Slf4j
public class FcmConfig {

    @Value("${shcp.fcm.credentials-base64:}")
    private String credentialsBase64;

    @Value("${shcp.fcm.credentials-path:/run/secrets/fcm-credentials.json}")
    private String credentialsPath;

    @Bean
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
        } catch (IOException e) {
            log.warn("Failed to load FCM credentials — push notifications disabled: {}", e.getMessage());
            return null;
        }
    }

    /** Null-safe: returns null when FCM credentials are not configured. */
    @Bean
    public FirebaseMessaging firebaseMessaging(Optional<FirebaseApp> firebaseApp) {
        return firebaseApp.map(FirebaseMessaging::getInstance).orElse(null);
    }

    private InputStream openCredentialsStream() throws IOException {
        if (StringUtils.hasText(credentialsBase64)) {
            byte[] decoded = Base64.getDecoder().decode(credentialsBase64.trim());
            return new ByteArrayInputStream(decoded);
        }
        java.io.File file = new java.io.File(credentialsPath);
        if (file.exists()) {
            return new FileInputStream(file);
        }
        return null;
    }
}
