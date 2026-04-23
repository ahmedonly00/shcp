package rw.shcp.messaging.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
        @JsonProperty("body") @NotBlank @Size(max = 5000) String body
) {}
