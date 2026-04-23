package rw.shcp.notifications;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.notifications.dto.NotificationDto;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "Retrieve and manage in-app notifications")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/me")
    @Operation(summary = "Get my notifications")
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getMyNotifications() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(notificationService.getMyNotifications(userId)));
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<ApiResponse<NotificationDto>> markAsRead(@PathVariable UUID id) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(notificationService.markAsRead(id, userId)));
    }

    @PatchMapping("/me/read-all")
    @Operation(summary = "Mark all my notifications as read")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead() {
        UUID userId = SecurityUtils.currentUserId();
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
