package rw.shcp.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    @Query("SELECT c FROM Conversation c WHERE c.patient.userId = :userId OR c.provider.userId = :userId ORDER BY c.createdAt DESC")
    List<Conversation> findAllByParticipantId(UUID userId);

    Optional<Conversation> findByPatientUserIdAndProviderUserId(UUID patientId, UUID providerId);
}
