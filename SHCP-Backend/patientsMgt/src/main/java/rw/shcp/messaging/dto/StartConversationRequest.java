package rw.shcp.messaging.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record StartConversationRequest(
        @JsonProperty("otherUserId") @NotNull UUID otherUserId
) {}
