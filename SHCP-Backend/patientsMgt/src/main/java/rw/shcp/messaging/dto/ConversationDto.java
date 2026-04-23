package rw.shcp.messaging.dto;

import rw.shcp.messaging.Conversation;
import rw.shcp.users.model.User;

import java.util.UUID;

public record ConversationDto(
        UUID conversationId,
        UUID participantId,
        String participantName,
        String participantRole,
        String lastMessage,
        String lastMessageTime,
        int unreadCount,
        boolean starred
) {
    /**
     * Build from a Conversation entity from the perspective of {@code currentUserId}.
     * The "participant" is the other side; starred/role are relative to the current user.
     */
    public static ConversationDto from(Conversation c, UUID currentUserId,
                                       String lastMessage, String lastMessageTime,
                                       int unreadCount) {
        boolean isPatient = c.getPatient().getUserId().equals(currentUserId);
        User other  = isPatient ? c.getProvider() : c.getPatient();
        boolean starred = isPatient ? c.isStarredByPatient() : c.isStarredByProvider();
        String role = isPatient ? "provider" : "patient";

        return new ConversationDto(
                c.getConversationId(),
                other.getUserId(),
                other.getName(),
                role,
                lastMessage,
                lastMessageTime,
                unreadCount,
                starred
        );
    }
}
