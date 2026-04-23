package rw.shcp.users.dto;

import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ProviderProfileDto(
        UUID userId,
        String name,
        String email,
        String phone,
        String role,
        String languagePref,
        boolean isVerified,
        String licenseNumber,
        String specialty,
        String facility,
        BigDecimal rating,
        boolean isActive,
        boolean isAvailableForInstant,
        String profilePictureUrl,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
    public static ProviderProfileDto from(Provider provider) {
        User u = provider.getUser();
        return new ProviderProfileDto(
                u.getUserId(),
                u.getName(),
                u.getEmail(),
                u.getPhone(),
                u.getRole().name(),
                u.getLanguagePref(),
                u.isVerified(),
                provider.getLicenseNumber(),
                provider.getSpecialty(),
                provider.getFacility(),
                provider.getRating(),
                provider.isActive(),
                provider.isAvailableForInstant(),
                u.getProfilePictureUrl(),
                u.getCreatedAt(),
                u.getUpdatedAt());
    }
}
