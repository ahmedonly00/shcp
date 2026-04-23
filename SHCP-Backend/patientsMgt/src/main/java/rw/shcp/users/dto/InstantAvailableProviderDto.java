package rw.shcp.users.dto;

import rw.shcp.users.model.Provider;

import java.math.BigDecimal;
import java.util.UUID;

public record InstantAvailableProviderDto(
        UUID   providerId,
        String name,
        String specialty,
        String facility,
        BigDecimal rating,
        String profilePictureUrl
) {
    public static InstantAvailableProviderDto from(Provider p) {
        return new InstantAvailableProviderDto(
                p.getUserId(),
                p.getUser().getName(),
                p.getSpecialty(),
                p.getFacility(),
                p.getRating(),
                p.getUser().getProfilePictureUrl()
        );
    }
}
