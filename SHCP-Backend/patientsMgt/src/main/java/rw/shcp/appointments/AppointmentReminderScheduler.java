package rw.shcp.appointments;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import rw.shcp.common.enums.AppointmentStatus;
import rw.shcp.common.enums.ConsultationStatus;
import rw.shcp.consultations.ConsultationRepository;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AppointmentReminderScheduler {

        private final AppointmentRepository appointmentRepository;
        private final ConsultationRepository consultationRepository;
        private final AvailabilityRepository availabilityRepository;
        private final NotificationPublisher notificationPublisher;

        /**
         * Grace period after scheduled time before a VIDEO appointment is marked
         * NO_SHOW.
         */
        private static final int NO_SHOW_GRACE_MINUTES = 30;

        /**
         * Maximum allowed consultation duration — stale IN_PROGRESS calls are
         * auto-closed after this.
         */
        private static final int MAX_CONSULTATION_HOURS = 2;

        /**
         * Fires every 15 minutes. Sends push notification for appointments 23h45m –
         * 24h15m away.
         */
        @Scheduled(cron = "0 */15 * * * *")
        public void send24HourReminders() {
                OffsetDateTime now = OffsetDateTime.now();
                OffsetDateTime from = now.plusHours(23).plusMinutes(45);
                OffsetDateTime to = now.plusHours(24).plusMinutes(15);

                List<Appointment> upcoming = appointmentRepository
                                .findByScheduledAtBetweenAndStatus(from, to, AppointmentStatus.CONFIRMED);

                for (Appointment appt : upcoming) {
                        String providerName = appt.getProvider().getUser().getName();
                        String message = "Reminder: your appointment with " + providerName +
                                        " is tomorrow at " + appt.getScheduledAt().toLocalTime() + ".";

                        Map<String, Object> meta = Map.of(
                                        "appointmentId", appt.getAppointmentId().toString(),
                                        "scheduledAt", appt.getScheduledAt().toString());

                        notificationPublisher.publish(NotificationEvent.push(
                                        appt.getPatient().getUserId(),
                                        "appointment.reminder.24h",
                                        message,
                                        meta));
                        log.debug("24h reminder queued for appointment {}", appt.getAppointmentId());
                }
        }

        /**
         * Fires every 5 minutes. Sends push notification for appointments 45m – 1h15m
         * away.
         */
        @Scheduled(cron = "0 */5 * * * *")
        public void send1HourReminders() {
                OffsetDateTime now = OffsetDateTime.now();
                OffsetDateTime from = now.plusMinutes(45);
                OffsetDateTime to = now.plusMinutes(75);

                List<Appointment> upcoming = appointmentRepository
                                .findByScheduledAtBetweenAndStatus(from, to, AppointmentStatus.CONFIRMED);

                for (Appointment appt : upcoming) {
                        String providerName = appt.getProvider().getUser().getName();
                        String message = "Your appointment with " + providerName +
                                        " starts in about 1 hour. Join on time!";

                        Map<String, Object> meta = Map.of(
                                        "appointmentId", appt.getAppointmentId().toString(),
                                        "scheduledAt", appt.getScheduledAt().toString());

                        notificationPublisher.publish(NotificationEvent.push(
                                        appt.getPatient().getUserId(),
                                        "appointment.reminder.1h",
                                        message,
                                        meta));
                        log.debug("1h reminder queued for appointment {}", appt.getAppointmentId());
                }
        }

        /**
         * Runs every 5 minutes.
         * Marks CONFIRMED VIDEO appointments as NO_SHOW when the scheduled time +
         * grace period has passed and neither party started the consultation.
         * Releases the availability slot so another patient can book it.
         */
        @Scheduled(cron = "0 */5 * * * *")
        @org.springframework.transaction.annotation.Transactional
        public void expireOverdueVideoAppointments() {
                OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(NO_SHOW_GRACE_MINUTES);

                List<Appointment> overdue = appointmentRepository.findOverdueVideoAppointments(
                                AppointmentStatus.CONFIRMED, cutoff);

                for (Appointment appt : overdue) {
                        appt.setStatus(AppointmentStatus.NO_SHOW);

                        // Release the slot so another patient can book
                        if (appt.getSlot() != null) {
                                appt.getSlot().setBooked(false);
                                availabilityRepository.save(appt.getSlot());
                        }

                        appointmentRepository.save(appt);

                        String providerName = appt.getProvider().getUser().getName();
                        String message = "Your video consultation with Dr. " + providerName +
                                        " scheduled for " + appt.getScheduledAt().toLocalDate() +
                                        " at " + appt.getScheduledAt().toLocalTime() +
                                        " has expired because it was not started within " +
                                        NO_SHOW_GRACE_MINUTES + " minutes. Please book a new appointment.";

                        Map<String, Object> meta = Map.of(
                                        "appointmentId", appt.getAppointmentId().toString(),
                                        "scheduledAt", appt.getScheduledAt().toString());

                        notificationPublisher.publish(NotificationEvent.email(
                                        appt.getPatient().getUserId(), "appointment.expired", message, meta));
                        notificationPublisher.publish(NotificationEvent.push(
                                        appt.getPatient().getUserId(), "appointment.expired", message, meta));

                        log.info("Appointment {} marked NO_SHOW (overdue by {}+ min)",
                                        appt.getAppointmentId(), NO_SHOW_GRACE_MINUTES);
                }
        }

        /**
         * Runs every 15 minutes.
         * Auto-closes consultations that were started but never ended (e.g. browser
         * closed
         * mid-call). Prevents stale IN_PROGRESS records from blocking future joins.
         */
        @Scheduled(cron = "0 */15 * * * *")
        @org.springframework.transaction.annotation.Transactional
        public void closeStaleConsultations() {
                OffsetDateTime cutoff = OffsetDateTime.now().minusHours(MAX_CONSULTATION_HOURS);

                List<Appointment> stale = appointmentRepository.findStaleInProgressAppointments(cutoff);

                for (Appointment appt : stale) {
                        consultationRepository.findByAppointment_AppointmentId(appt.getAppointmentId())
                                        .ifPresent(c -> {
                                                if (c.getStatus() == ConsultationStatus.IN_PROGRESS) {
                                                        c.setStatus(ConsultationStatus.COMPLETED);
                                                        c.setEndedAt(OffsetDateTime.now());
                                                        c.setNotes("[Auto-closed: consultation exceeded maximum duration]");
                                                        consultationRepository.save(c);
                                                        log.info("Auto-closed stale consultation {} for appointment {}",
                                                                        c.getConsultationId(), appt.getAppointmentId());
                                                }
                                        });

                        appt.setStatus(AppointmentStatus.COMPLETED);
                        appointmentRepository.save(appt);
                }
        }
}
