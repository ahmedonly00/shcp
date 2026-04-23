package rw.shcp.users.dto;

import java.math.BigDecimal;
import java.util.UUID;

import rw.shcp.users.model.Provider;

/** Lightweight provider card shown in the public listing. */
public record ProviderSummaryDto(
        UUID       providerId,
        String     name,
        String     specialty,
        String     facility,
        BigDecimal rating,
        boolean    isActive,
        boolean    isAvailableForInstant
) {
    public static ProviderSummaryDto from(Provider provider) {
        return new ProviderSummaryDto(
                provider.getUserId(),
                provider.getUser().getName(),
                provider.getSpecialty(),
                provider.getFacility(),
                provider.getRating(),
                provider.isActive(),
                provider.isAvailableForInstant()
        );
    }
}
