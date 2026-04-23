package rw.shcp.messaging;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findAllByConversationConversationIdOrderBySentAtAsc(UUID conversationId);

    Optional<Message> findTopByConversationConversationIdOrderBySentAtDesc(UUID conversationId);

    long countByConversationConversationIdAndSenderUserIdNotAndReadFalse(UUID conversationId, UUID currentUserId);

    List<Message> findAllByConversationConversationIdAndSenderUserIdNotAndReadFalse(UUID conversationId, UUID currentUserId);
}
