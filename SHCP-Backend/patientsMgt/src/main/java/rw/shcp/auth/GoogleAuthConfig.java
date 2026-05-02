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

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

/**
 * Initialises Firebase Admin SDK in the backend solely for
 * verifying Google sign-in ID tokens ({@link FirebaseAuth#verifyIdToken}).
 * No messaging (FCM) is configured here — that lives in the notification-consumer.
 */
@Configuration
@Slf4j
public class GoogleAuthConfig {

    @Value("${shcp.firebase.credentials-base64:}")
    private String credentialsBase64;

    @Value("${shcp.firebase.credentials-path:}")
    private String credentialsPath;

    @Bean
    public FirebaseApp firebaseApp() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        try (InputStream is = openCredentialsStream()) {
            if (is == null) {
                log.warn("Firebase credentials not configured — Google login disabled. " +
                         "Set FIREBASE_CREDENTIALS_BASE64 or FIREBASE_CREDENTIALS_PATH to enable it.");
                return null;
            }
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(is))
                    .build();
            FirebaseApp app = FirebaseApp.initializeApp(options);
            log.info("Firebase Admin SDK initialised for Google auth");
            return app;
        } catch (IOException e) {
            log.warn("Failed to load Firebase credentials — Google login disabled: {}", e.getMessage());
            return null;
        }
    }

    private InputStream openCredentialsStream() throws IOException {
        if (credentialsBase64 != null && !credentialsBase64.isBlank()) {
            byte[] decoded = Base64.getDecoder().decode(credentialsBase64.trim());
            return new ByteArrayInputStream(decoded);
        }
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            java.io.File file = new java.io.File(credentialsPath);
            if (file.exists()) {
                return new FileInputStream(file);
            }
        }
        return null;
    }

    /** Null when Firebase is not configured — callers must check before use. */
    @Bean
    public FirebaseAuth firebaseAuth(@Autowired(required = false) FirebaseApp firebaseApp) {
        return firebaseApp != null ? FirebaseAuth.getInstance(firebaseApp) : null;
    }
}
