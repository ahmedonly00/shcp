package rw.shcp.pharmacy.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreatePharmacyRequest(
        @JsonProperty("name")
        @NotBlank @Size(max = 150)
        String name,

        @JsonProperty("address")
        @NotBlank @Size(max = 300)
        String address,

        // ── Rwanda administrative hierarchy (District → Sector → Cell) ─────
        @JsonProperty("district")
        @Size(max = 60)
        String district,

        @JsonProperty("sector")
        @Size(max = 80)
        String sector,

        @JsonProperty("cell")
        @Size(max = 80)
        String cell,

        // ── GPS coordinates (WGS-84) ──────────────────────────────────────
        // Optional but strongly recommended for accurate Haversine tiebreaking.
        @JsonProperty("latitude")
        Double latitude,

        @JsonProperty("longitude")
        Double longitude,

        @JsonProperty("phone")
        @Pattern(regexp = "^(\\+250[0-9]{9,10})?$", message = "Phone must be a Rwanda number in the format +250XXXXXXXXX")
        String phone,

        @JsonProperty("email")
        @Size(max = 150)
        String email
) {}
