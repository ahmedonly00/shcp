package rw.shcp.pharmacy.dto;

import rw.shcp.pharmacy.Pharmacist;

import java.util.UUID;

public record PharmacistProfileDto(
        UUID   userId,
        String name,
        String email,
        String phone,
        UUID   pharmacyId,
        String pharmacyName,
        /** Only populated on initial creation — null in list responses. */
        String tempPassword
) {
    /** For list display — no temp password. */
    public static PharmacistProfileDto from(Pharmacist ph) {
        return new PharmacistProfileDto(
                ph.getUserId(),
                ph.getUser().getName(),
                ph.getUser().getEmail(),
                ph.getUser().getPhone(),
                ph.getPharmacy().getPharmacyId(),
                ph.getPharmacy().getName(),
                null
        );
    }
}
