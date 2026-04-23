package rw.shcp.pharmacy.dto;

import rw.shcp.pharmacy.Biker;

import java.util.UUID;

public record BikerDto(
        UUID   userId,
        UUID   pharmacyId,
        String name,
        String email,
        String phone,
        String licenseNumber,
        String vehicleType,
        String operatingZone,
        String status,
        /** Only populated on initial registration — null in list responses. */
        String tempPassword
) {
    public static BikerDto from(Biker b) {
        return new BikerDto(
                b.getUserId(),
                b.getPharmacy().getPharmacyId(),
                b.getUser().getName(),
                b.getUser().getEmail(),
                b.getUser().getPhone(),
                b.getLicenseNumber(),
                b.getVehicleType(),
                b.getOperatingZone(),
                b.getStatus().name(),
                null
        );
    }
}
