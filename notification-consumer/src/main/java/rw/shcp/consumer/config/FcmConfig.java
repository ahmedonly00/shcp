package rw.shcp.consumer.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

@Configuration
@Slf4j
public class FcmConfig {

    @Value("${shcp.fcm.credentials-path:/run/secrets/fcm-credentials.json}")
    private String credentialsPath;

    @Bean
    public FirebaseApp firebaseApp() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        try (InputStream is = new FileInputStream(credentialsPath)) {
            GoogleCredentials credentials = GoogleCredentials.fromStream(is);
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(credentials)
                    .build();
            FirebaseApp app = FirebaseApp.initializeApp(options);
            log.info("Firebase Admin SDK initialised from {}", credentialsPath);
            return app;
        } catch (IOException e) {
            log.warn("FCM credentials not found at {} — push notifications disabled. " +
                     "Provide FCM_CREDENTIALS_PATH to enable them.", credentialsPath);
            return null;
        }
    }

    /** Null-safe: returns null when FCM credentials are not configured. */
    @Bean
    public FirebaseMessaging firebaseMessaging(Optional<FirebaseApp> firebaseApp) {
        return firebaseApp.map(FirebaseMessaging::getInstance).orElse(null);
    }
}
