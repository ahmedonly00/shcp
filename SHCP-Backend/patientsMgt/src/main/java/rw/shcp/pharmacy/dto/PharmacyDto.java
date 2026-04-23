package rw.shcp.pharmacy.dto;

import rw.shcp.pharmacy.Pharmacy;

import java.util.UUID;

public record PharmacyDto(
        UUID    pharmacyId,
        String  name,
        String  address,
        String  district,
        String  sector,
        String  cell,
        Double  latitude,
        Double  longitude,
        String  phone,
        String  email,
        boolean isActive
) {
    public static PharmacyDto from(Pharmacy p) {
        return new PharmacyDto(
                p.getPharmacyId(),
                p.getName(),
                p.getAddress(),
                p.getDistrict(),
                p.getSector(),
                p.getCell(),
                p.getLatitude(),
                p.getLongitude(),
                p.getPhone(),
                p.getEmail(),
                p.isActive()
        );
    }
}
