package rw.shcp.pharmacy.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterBikerRequest(
        @JsonProperty("name")
        @NotBlank @Size(max = 100)
        String name,

        @JsonProperty("email")
        @NotBlank @Email @Size(max = 150)
        String email,

        @JsonProperty("phone")
        @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$")
        String phone,

        @JsonProperty("licenseNumber")
        @Size(max = 50)
        String licenseNumber,

        @JsonProperty("vehicleType")
        @NotBlank @Size(max = 50)
        String vehicleType,

        @JsonProperty("operatingZone")
        @Size(max = 100)
        String operatingZone
) {}
