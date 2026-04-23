package rw.shcp.pharmacy.dto;

import rw.shcp.pharmacy.PharmacyInventory;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record InventoryItemDto(
        UUID         inventoryId,
        UUID         pharmacyId,
        String       medicationName,
        String       genericName,
        int          quantityInStock,
        String       unit,
        LocalDate    expiryDate,
        int          reorderLevel,
        boolean      lowStock,
        OffsetDateTime updatedAt
) {
    public static InventoryItemDto from(PharmacyInventory pi) {
        return new InventoryItemDto(
                pi.getInventoryId(),
                pi.getPharmacy().getPharmacyId(),
                pi.getMedicationName(),
                pi.getGenericName(),
                pi.getQuantityInStock(),
                pi.getUnit(),
                pi.getExpiryDate(),
                pi.getReorderLevel(),
                pi.getQuantityInStock() <= pi.getReorderLevel(),
                pi.getUpdatedAt()
        );
    }
}
