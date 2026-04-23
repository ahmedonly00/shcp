package rw.shcp.pharmacy.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StockUpdateRequest(
        @JsonProperty("medicationName")
        @NotBlank @Size(max = 200)
        String medicationName,

        @JsonProperty("genericName")
        @Size(max = 200)
        String genericName,

        /** Absolute quantity to set (not a delta). */
        @JsonProperty("quantityInStock")
        @Min(0)
        int quantityInStock,

        @JsonProperty("unit")
        @Size(max = 50)
        String unit,

        @JsonProperty("expiryDate")
        String expiryDate,  // ISO date string yyyy-MM-dd, nullable

        @JsonProperty("reorderLevel")
        @Min(0)
        Integer reorderLevel
) {}
