package rw.shcp.consumer.provider;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import javax.mail.internet.InternetAddress;
import java.io.UnsupportedEncodingException;

@Component
@RequiredArgsConstructor
@Slf4j
public class JavaMailEmailProvider implements EmailProvider {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${mail.from-name:SHCP Health Platform}")
    private String fromName;

    @Override
    public void send(String to, String subject, String body) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(new InternetAddress(fromEmail, fromName, "UTF-8").toString());
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
            log.debug("Email sent via JavaMail to {}", to);
        } catch (UnsupportedEncodingException e) {
            throw new NotificationDeliveryException("Invalid From address configuration", e);
        } catch (Exception e) {
            throw new NotificationDeliveryException("Failed to send email to " + to, e);
        }
    }
}
