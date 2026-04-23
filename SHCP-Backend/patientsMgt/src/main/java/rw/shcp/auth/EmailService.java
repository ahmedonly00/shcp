package rw.shcp.auth;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:noreply@shcp.rw}")
    private String fromEmail;

    @Value("${mail.from-name:SHCP Health Platform}")
    private String fromName;

    @Async
    public void sendOtp(String toEmail, String name, String otp) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject("SHCP — Email Verification Code");
            msg.setText("""
                    Hello %s,

                    Your email verification code is:

                        %s

                    This code expires in 15 minutes.
                    If you did not request this, please ignore this email.

                    — SHCP Health Platform
                    """.formatted(name, otp));
            mailSender.send(msg);
            log.info("OTP email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send OTP email to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendPasswordResetOtp(String toEmail, String name, String otp) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject("SHCP — Password Reset Code");
            msg.setText("""
                    Hello %s,

                    Your password reset code is:

                        %s

                    This code expires in 15 minutes.
                    If you did not request a password reset, please ignore this email.

                    — SHCP Health Platform
                    """.formatted(name, otp));
            mailSender.send(msg);
            log.info("Password reset OTP sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send password reset email to {}: {}", toEmail, e.getMessage());
        }
    }

    @Async
    public void sendMohReport(List<String> toEmails, String period, byte[] csvBytes, byte[] xlsxBytes) {
        if (toEmails == null || toEmails.isEmpty()) return;
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmails.toArray(new String[0]));
            helper.setSubject("SHCP Ministry of Health Report — " + period);
            helper.setText("""
                    Dear MOH Team,

                    Please find attached the SHCP platform analytics report for the period: %s.

                    This report includes metrics on consultations, appointments, registrations,
                    symptom reports, prescriptions, and active providers.

                    — SHCP Health Platform (Automated Report)
                    """.formatted(period));
            helper.addAttachment("moh-report-" + period + ".csv",
                    new ByteArrayResource(csvBytes), "text/csv");
            if (xlsxBytes != null) {
                helper.addAttachment("moh-report-" + period + ".xlsx",
                        new ByteArrayResource(xlsxBytes),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            }
            mailSender.send(msg);
            log.info("MOH report email sent to {} recipients for {}", toEmails.size(), period);
        } catch (MessagingException e) {
            log.error("Failed to send MOH report email: {}", e.getMessage());
        }
    }

    @Async
    public void sendSupportTicketConfirmation(String toEmail, String name,
                                              UUID ticketId, String subject) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromEmail);
            msg.setTo(toEmail);
            msg.setSubject("SHCP — Support Ticket Received");
            msg.setText("""
                    Hello %s,

                    We have received your support request and will get back to you within 24 hours.

                    Ticket ID : %s
                    Subject   : %s

                    You can reply to this email if you have additional details to add.

                    — SHCP Health Platform Support Team
                    """.formatted(name, ticketId, subject));
            mailSender.send(msg);
            log.info("Support ticket confirmation sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send support ticket confirmation to {}: {}", toEmail, e.getMessage());
        }
    }
}
