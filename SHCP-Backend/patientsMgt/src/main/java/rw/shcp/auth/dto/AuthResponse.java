package rw.shcp.auth.dto;

import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UUID userId,
        String email,
        String role,
        boolean isVerified,
        /** false only for PATIENT accounts that still have null dateOfBirth or nationalId (e.g. Google OAuth sign-ups) */
        boolean profileComplete
) {
    public static AuthResponse of(String access, String refresh, long expiresIn,
                                   UUID userId, String email, String role,
                                   boolean verified, boolean profileComplete) {
        return new AuthResponse(access, refresh, "Bearer", expiresIn, userId, email, role, verified, profileComplete);
    }
}
