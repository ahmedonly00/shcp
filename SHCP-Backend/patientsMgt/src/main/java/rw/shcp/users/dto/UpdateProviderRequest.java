package rw.shcp.users.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProviderRequest(

        @JsonProperty("name")
        @Size(max = 100)
        String name,

        @JsonProperty("phone")
        @Pattern(regexp = "^\\+250[0-9]{9,10}$", message = "Phone must be a Rwanda number in the format +250XXXXXXXXX")
        String phone,

        @JsonProperty("languagePref")
        @Pattern(regexp = "^(rw|en|fr)$", message = "Language must be rw, en, or fr")
        String languagePref,

        /** Firebase FCM device token for push notifications. */
        @JsonProperty("deviceToken")
        String deviceToken,

        @JsonProperty("specialty")
        @Size(max = 100)
        String specialty,

        @JsonProperty("facility")
        @Size(max = 150)
        String facility
) {}
