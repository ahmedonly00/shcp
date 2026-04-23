package rw.shcp.consumer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Standalone notification consumer service.
 *
 * <p>Listens to two RabbitMQ queues (EMAIL, PUSH) and delivers
 * messages via JavaMail (SMTP) and Firebase Cloud Messaging.
 * Completely independent of the SHCP core API — no shared code, no shared classpath.</p>
 */
@SpringBootApplication
@EnableAsync
public class NotificationConsumerApp {

    public static void main(String[] args) {
        SpringApplication.run(NotificationConsumerApp.class, args);
    }
}
