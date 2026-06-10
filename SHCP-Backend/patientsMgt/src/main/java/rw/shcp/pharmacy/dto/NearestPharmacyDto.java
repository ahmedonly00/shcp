package rw.shcp.pharmacy.dto;

import rw.shcp.pharmacy.Pharmacy;

import java.util.UUID;

public record NearestPharmacyDto(
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
        boolean isActive,
        /** Haversine distance in km — null when no GPS coordinates were supplied in the query. */
        Double  distanceKm,
        /** How closely this pharmacy's admin area matches the query: CELL, SECTOR, DISTRICT, or OTHER. */
        String  matchLevel
) {
    public static NearestPharmacyDto from(Pharmacy p, Double distanceKm, String matchLevel) {
        return new NearestPharmacyDto(
                p.getPharmacyId(), p.getName(), p.getAddress(),
                p.getDistrict(), p.getSector(), p.getCell(),
                p.getLatitude(), p.getLongitude(),
                p.getPhone(), p.getEmail(), p.isActive(),
                distanceKm, matchLevel
        );
    }
}
