package rw.shcp.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.messaging.dto.ConversationDto;
import rw.shcp.messaging.dto.MessageDto;
import rw.shcp.messaging.dto.SendMessageRequest;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class MessageService {

    private final ConversationRepository conversationRepo;
    private final MessageRepository      messageRepo;
    private final UserRepository         userRepo;

    /** Return all conversations the current user participates in, newest first. */
    public List<ConversationDto> listMyConversations(UUID userId) {
        return conversationRepo.findAllByParticipantId(userId)
                .stream()
                .map(c -> toDto(c, userId))
                .toList();
    }

    /**
     * Find an existing conversation between the two users, or create one.
     * Roles are resolved automatically: the PATIENT side goes to patient_id,
     * the PROVIDER/DOCTOR side goes to provider_id.
     */
    @Transactional
    public ConversationDto getOrStart(UUID currentUserId, UUID otherUserId) {
        User current = userRepo.findById(currentUserId)
                .orElseThrow(() -> AppException.notFound("User not found"));
        User other = userRepo.findById(otherUserId)
                .orElseThrow(() -> AppException.notFound("User not found"));

        UUID patientId  = resolvePatientId(current, other);
        UUID providerId = resolveProviderId(current, other);

        Conversation conv = conversationRepo
                .findByPatientUserIdAndProviderUserId(patientId, providerId)
                .orElseGet(() -> {
                    User patient  = patientId.equals(currentUserId)  ? current : other;
                    User provider = providerId.equals(currentUserId) ? current : other;
                    Conversation c = new Conversation();
                    c.setPatient(patient);
                    c.setProvider(provider);
                    return conversationRepo.save(c);
                });

        log.info("Conversation {} between patient={} provider={}", conv.getConversationId(), patientId, providerId);
        return toDto(conv, currentUserId);
    }

    /** Get all messages in a conversation (marks unread messages as read). */
    @Transactional
    public List<MessageDto> getMessages(UUID convId, UUID currentUserId) {
        Conversation conv = findConvForUser(convId, currentUserId);

        // Mark messages sent by the other party as read
        List<Message> unread = messageRepo
                .findAllByConversationConversationIdAndSenderUserIdNotAndReadFalse(convId, currentUserId);
        if (!unread.isEmpty()) {
            unread.forEach(m -> m.setRead(true));
            messageRepo.saveAll(unread);
        }

        return messageRepo.findAllByConversationConversationIdOrderBySentAtAsc(convId)
                .stream().map(MessageDto::from).toList();
    }

    /** Send a message in an existing conversation. */
    @Transactional
    public MessageDto sendMessage(UUID convId, UUID senderId, SendMessageRequest req) {
        Conversation conv   = findConvForUser(convId, senderId);
        User         sender = userRepo.findById(senderId)
                .orElseThrow(() -> AppException.notFound("User not found"));

        Message msg = new Message();
        msg.setConversation(conv);
        msg.setSender(sender);
        msg.setBody(req.body());

        Message saved = messageRepo.save(msg);
        log.info("Message {} sent in conversation {} by user={}", saved.getMessageId(), convId, senderId);
        return MessageDto.from(saved);
    }

    /** Mark all messages from the other party as read. */
    @Transactional
    public void markAsRead(UUID convId, UUID currentUserId) {
        findConvForUser(convId, currentUserId);
        List<Message> unread = messageRepo
                .findAllByConversationConversationIdAndSenderUserIdNotAndReadFalse(convId, currentUserId);
        if (!unread.isEmpty()) {
            unread.forEach(m -> m.setRead(true));
            messageRepo.saveAll(unread);
        }
    }

    /** Toggle the starred flag for the current user's side of the conversation. */
    @Transactional
    public ConversationDto toggleStar(UUID convId, UUID currentUserId) {
        Conversation conv = findConvForUser(convId, currentUserId);
        if (conv.getPatient().getUserId().equals(currentUserId)) {
            conv.setStarredByPatient(!conv.isStarredByPatient());
        } else {
            conv.setStarredByProvider(!conv.isStarredByProvider());
        }
        conversationRepo.save(conv);
        return toDto(conv, currentUserId);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private ConversationDto toDto(Conversation c, UUID currentUserId) {
        Optional<Message> last = messageRepo
                .findTopByConversationConversationIdOrderBySentAtDesc(c.getConversationId());
        int unread = (int) messageRepo
                .countByConversationConversationIdAndSenderUserIdNotAndReadFalse(
                        c.getConversationId(), currentUserId);
        return ConversationDto.from(c, currentUserId,
                last.map(Message::getBody).orElse(null),
                last.map(m -> m.getSentAt().toString()).orElse(null),
                unread);
    }

    private Conversation findConvForUser(UUID convId, UUID userId) {
        Conversation conv = conversationRepo.findById(convId)
                .orElseThrow(() -> AppException.notFound("Conversation not found"));
        if (!conv.getPatient().getUserId().equals(userId)
                && !conv.getProvider().getUserId().equals(userId)) {
            throw AppException.forbidden("Access denied");
        }
        return conv;
    }

    private UUID resolvePatientId(User a, User b) {
        if (a.getRole() == Role.PATIENT) return a.getUserId();
        if (b.getRole() == Role.PATIENT) return b.getUserId();
        throw AppException.badRequest("One participant must be a patient");
    }

    private UUID resolveProviderId(User a, User b) {
        if (a.getRole() == Role.PROVIDER) return a.getUserId();
        if (b.getRole() == Role.PROVIDER) return b.getUserId();
        throw AppException.badRequest("One participant must be a provider");
    }
}
