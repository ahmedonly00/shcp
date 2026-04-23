package rw.shcp.messaging;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.messaging.dto.ConversationDto;
import rw.shcp.messaging.dto.MessageDto;
import rw.shcp.messaging.dto.SendMessageRequest;
import rw.shcp.messaging.dto.StartConversationRequest;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Messages", description = "Secure patient-provider messaging")
public class MessageController {

    private final MessageService messageService;

    @GetMapping("/conversations")
    @Operation(summary = "List my conversations")
    public ResponseEntity<ApiResponse<List<ConversationDto>>> list() {
        return ResponseEntity.ok(ApiResponse.ok(
                messageService.listMyConversations(SecurityUtils.currentUserId())));
    }

    @PostMapping("/conversations")
    @Operation(summary = "Start or retrieve an existing conversation")
    public ResponseEntity<ApiResponse<ConversationDto>> start(
            @Valid @RequestBody StartConversationRequest req) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        messageService.getOrStart(SecurityUtils.currentUserId(), req.otherUserId())));
    }

    @GetMapping("/conversations/{convId}/messages")
    @Operation(summary = "Get all messages in a conversation (also marks them as read)")
    public ResponseEntity<ApiResponse<List<MessageDto>>> messages(
            @PathVariable UUID convId) {
        return ResponseEntity.ok(ApiResponse.ok(
                messageService.getMessages(convId, SecurityUtils.currentUserId())));
    }

    @PostMapping("/conversations/{convId}/messages")
    @Operation(summary = "Send a message")
    public ResponseEntity<ApiResponse<MessageDto>> send(
            @PathVariable UUID convId,
            @Valid @RequestBody SendMessageRequest req) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.ok(
                        messageService.sendMessage(convId, SecurityUtils.currentUserId(), req)));
    }

    @PatchMapping("/conversations/{convId}/read")
    @Operation(summary = "Mark all messages in a conversation as read")
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable UUID convId) {
        messageService.markAsRead(convId, SecurityUtils.currentUserId());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PatchMapping("/conversations/{convId}/star")
    @Operation(summary = "Toggle starred status for this conversation")
    public ResponseEntity<ApiResponse<ConversationDto>> star(@PathVariable UUID convId) {
        return ResponseEntity.ok(ApiResponse.ok(
                messageService.toggleStar(convId, SecurityUtils.currentUserId())));
    }
}
