package rw.shcp.messaging.dto;

import rw.shcp.messaging.Message;

import java.util.UUID;

public record MessageDto(
        UUID messageId,
        UUID conversationId,
        UUID senderId,
        String senderName,
        String body,
        String sentAt,
        boolean read
) {
    public static MessageDto from(Message m) {
        return new MessageDto(
                m.getMessageId(),
                m.getConversation().getConversationId(),
                m.getSender().getUserId(),
                m.getSender().getName(),
                m.getBody(),
                m.getSentAt().toString(),
                m.isRead()
        );
    }
}
