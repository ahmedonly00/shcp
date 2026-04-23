package rw.shcp.appointments;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.appointments.dto.JoinWaitlistRequest;
import rw.shcp.appointments.dto.WaitlistDto;
import rw.shcp.common.exception.AppException;
import rw.shcp.notifications.NotificationEvent;
import rw.shcp.notifications.NotificationPublisher;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class WaitlistService {

    private final WaitlistRepository  waitlistRepository;
    private final PatientRepository   patientRepository;
    private final ProviderRepository  providerRepository;
    private final NotificationPublisher notificationPublisher;

    @Transactional
    public WaitlistDto join(UUID patientId, JoinWaitlistRequest req) {
        if (waitlistRepository.existsByPatient_UserIdAndProvider_UserIdAndDate(
                patientId, req.providerId(), req.date())) {
            throw AppException.conflict("You are already on the waitlist for this date");
        }

        Patient  patient  = patientRepository.findById(patientId)
                .orElseThrow(() -> AppException.notFound("Patient not found"));
        Provider provider = providerRepository.findById(req.providerId())
                .orElseThrow(() -> AppException.notFound("Provider not found"));

        Waitlist entry = new Waitlist();
        entry.setPatient(patient);
        entry.setProvider(provider);
        entry.setDate(req.date());
        entry.setType(req.type() != null ? req.type() : "VIDEO");
        Waitlist saved = waitlistRepository.save(entry);

        List<Waitlist> queue = waitlistRepository
                .findByProvider_UserIdAndDateOrderByCreatedAtAsc(req.providerId(), req.date());
        int position = queue.indexOf(saved) + 1;

        log.info("Patient {} joined waitlist for provider {} on {} (position {})",
                patientId, req.providerId(), req.date(), position);
        return WaitlistDto.from(saved, position);
    }

    @Transactional
    public void leave(UUID patientId, UUID entryId) {
        Waitlist entry = waitlistRepository.findById(entryId)
                .orElseThrow(() -> AppException.notFound("Waitlist entry not found"));
        if (!entry.getPatient().getUserId().equals(patientId)) {
            throw AppException.forbidden("Not your waitlist entry");
        }
        waitlistRepository.delete(entry);
    }

    public List<WaitlistDto> myEntries(UUID patientId) {
        return waitlistRepository.findByPatient_UserIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(w -> {
                    List<Waitlist> queue = waitlistRepository
                            .findByProvider_UserIdAndDateOrderByCreatedAtAsc(
                                    w.getProvider().getUserId(), w.getDate());
                    int pos = queue.indexOf(w) + 1;
                    return WaitlistDto.from(w, pos);
                })
                .toList();
    }

    /** Called when a slot opens up — notify all waitlisted patients for that provider/date. */
    @Transactional
    public void notifyWaitlist(UUID providerId, LocalDate date) {
        List<Waitlist> pending = waitlistRepository.findPendingByProviderAndDate(providerId, date);
        AtomicInteger pos = new AtomicInteger(1);
        pending.forEach(w -> {
            String message = "A slot has opened with " + w.getProvider().getUser().getName() +
                    " on " + date + ". You are position " + pos.getAndIncrement() +
                    " on the waitlist. Log in to book now.";
            notificationPublisher.publish(NotificationEvent.push(
                    w.getPatient().getUserId(), "waitlist.slot_available", message,
                    Map.of("providerId", providerId.toString(), "date", date.toString())));
            notificationPublisher.publish(NotificationEvent.email(
                    w.getPatient().getUserId(), "waitlist.slot_available", message,
                    Map.of("providerId", providerId.toString(), "date", date.toString())));
            w.setNotified(true);
        });
        waitlistRepository.saveAll(pending);
    }
}
