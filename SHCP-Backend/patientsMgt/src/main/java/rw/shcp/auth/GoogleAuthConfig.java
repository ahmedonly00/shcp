package rw.shcp.auth;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Initialises Firebase Admin SDK in the backend solely for
 * verifying Google sign-in ID tokens ({@link FirebaseAuth#verifyIdToken}).
 * No messaging (FCM) is configured here — that lives in the notification-consumer.
 */
@Configuration
@Slf4j
public class GoogleAuthConfig {

    @Value("${shcp.firebase.credentials-path:}")
    private String credentialsPath;

    @Bean
    public FirebaseApp firebaseApp() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        if (credentialsPath == null || credentialsPath.isBlank()) {
            log.warn("shcp.firebase.credentials-path not set — Google login disabled");
            return null;
        }
        try (InputStream is = new FileInputStream(credentialsPath)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(is))
                    .build();
            FirebaseApp app = FirebaseApp.initializeApp(options);
            log.info("Firebase Admin SDK initialised for Google auth from {}", credentialsPath);
            return app;
        } catch (IOException e) {
            log.warn("Firebase credentials not found at {} — Google login disabled: {}",
                    credentialsPath, e.getMessage());
            return null;
        }
    }

    /** Null when Firebase is not configured — callers must check before use. */
    @Bean
    public FirebaseAuth firebaseAuth(@Autowired(required = false) FirebaseApp firebaseApp) {
        return firebaseApp != null ? FirebaseAuth.getInstance(firebaseApp) : null;
    }
}
