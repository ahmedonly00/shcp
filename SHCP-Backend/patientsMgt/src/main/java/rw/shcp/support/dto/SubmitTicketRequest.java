package rw.shcp.support.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SubmitTicketRequest(

        @JsonProperty("name")
        @NotBlank @Size(max = 100)
        String name,

        @JsonProperty("email")
        @NotBlank @Email @Size(max = 150)
        String email,

        @JsonProperty("subject")
        @NotBlank @Size(max = 255)
        String subject,

        @JsonProperty("message")
        @NotBlank
        String message,

        @JsonProperty("priority")
        @Pattern(regexp = "^(LOW|MEDIUM|URGENT)$", message = "Priority must be LOW, MEDIUM, or URGENT")
        String priority
) {}
