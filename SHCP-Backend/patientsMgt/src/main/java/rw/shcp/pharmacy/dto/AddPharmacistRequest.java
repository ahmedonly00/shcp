package rw.shcp.pharmacy.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AddPharmacistRequest(
        @JsonProperty("name")
        @NotBlank @Size(max = 150)
        String name,

        @JsonProperty("email")
        @NotBlank @Email @Size(max = 150)
        String email,

        @JsonProperty("phone")
        @NotBlank @Pattern(regexp = "^\\+250[0-9]{9,10}$", message = "Phone must be a Rwanda number in the format +250XXXXXXXXX")
        String phone
) {}
