package rw.shcp.prescriptions.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record IssuePrescriptionRequest(
        /** Optional: link prescription to a completed consultation. */
        @JsonProperty("consultationId")
        UUID consultationId,

        @JsonProperty("patientId")
        @NotNull UUID patientId,

        @JsonProperty("medications")
        @NotEmpty @Valid
        List<MedicationItem> medications,

        @JsonProperty("instructions")
        @Size(max = 2000) String instructions,

        /** Days until the prescription expires (e.g. 30). */
        @JsonProperty("validForDays")
        @Positive int validForDays,

        /** Provider's digital signature (full name) for authentication. */
        @JsonProperty("providerSignature")
        @Size(max = 500) String providerSignature,

        /** Full street / landmark delivery address (human-readable). */
        @JsonProperty("deliveryAddress")
        @Size(max = 300) String deliveryAddress,

        // ── Rwanda administrative hierarchy for nearest-pharmacy matching ──────
        /** e.g. "Gasabo" */
        @JsonProperty("deliveryDistrict")
        @Size(max = 60) String deliveryDistrict,

        /** e.g. "Remera" */
        @JsonProperty("deliverySector")
        @Size(max = 80) String deliverySector,

        /** e.g. "Rukiri I" */
        @JsonProperty("deliveryCell")
        @Size(max = 80) String deliveryCell,

        // ── GPS coordinates (WGS-84) ─────────────────────────────────────────
        // Optional. When provided, enables Haversine distance tiebreaking so the
        // physically closest pharmacy at the matched administrative level is chosen.
        @JsonProperty("deliveryLatitude")
        Double deliveryLatitude,

        @JsonProperty("deliveryLongitude")
        Double deliveryLongitude
) {}
