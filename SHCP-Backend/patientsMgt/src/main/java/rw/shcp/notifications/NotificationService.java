package rw.shcp.notifications;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.exception.AppException;
import rw.shcp.notifications.dto.NotificationDto;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRecordRepository repository;

    public List<NotificationDto> getMyNotifications(UUID userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationDto::from)
                .toList();
    }

    @Transactional
    public NotificationDto markAsRead(UUID notificationId, UUID userId) {
        NotificationRecord record = repository.findById(notificationId)
                .orElseThrow(() -> AppException.notFound("Notification not found"));

        if (!record.getUserId().equals(userId)) {
            throw AppException.forbidden("You do not have access to this notification");
        }

        record.setRead(true);
        return NotificationDto.from(repository.save(record));
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        List<NotificationRecord> unread = repository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .filter(r -> !r.isRead())
                .toList();

        unread.forEach(r -> r.setRead(true));
        repository.saveAll(unread);
    }
}
