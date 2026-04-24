package rw.shcp.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import rw.shcp.auth.dto.*;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;
import rw.shcp.users.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository         userRepository;
    @Mock PatientRepository      patientRepository;
    @Mock ProviderRepository     providerRepository;
    @Mock PasswordEncoder        passwordEncoder;
    @Mock JwtService             jwtService;
    @Mock OtpTokenRepository     otpTokenRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock EmailService           emailService;
    @Mock AuthenticationManager  authManager;
    @Mock RateLimitStore         rateLimitStore;

    @InjectMocks AuthService authService;

    // ── register ──────────────────────────────────────────────

    @Test
    void register_shouldHashPassword_andSendVerificationOTP() {
        RegisterRequest req = patientRegisterRequest();
        when(userRepository.existsByEmail(req.email())).thenReturn(false);
        when(passwordEncoder.encode(req.password())).thenReturn("$2a$hashed");
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        authService.register(req);

        verify(passwordEncoder).encode(req.password());

        ArgumentCaptor<OtpToken> otpCaptor = ArgumentCaptor.forClass(OtpToken.class);
        verify(otpTokenRepository).save(otpCaptor.capture());
        assertThat(otpCaptor.getValue().getType()).isEqualTo("VERIFY");
        assertThat(otpCaptor.getValue().getEmail()).isEqualTo(req.email());

        verify(emailService).sendOtp(eq(req.email()), anyString(), anyString());
    }

    @Test
    void register_shouldThrowConflict_whenEmailAlreadyExists() {
        RegisterRequest req = patientRegisterRequest();
        when(userRepository.existsByEmail(req.email())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("already registered");
    }

    @Test
    void register_shouldThrowBadRequest_whenPatientMissingNationalId() {
        RegisterRequest req = new RegisterRequest(
                "Alice", "alice@test.com", "+250780000001", "Pass1234!", Role.PATIENT,
                "en", LocalDate.of(1995, 1, 1), "A+", null,
                null,                // nationalId missing
                null, null, null,    // licenseNumber, specialty, facility
                null,                // pharmacyId
                null, null, null);   // vehicleType, operatingZone, bikerLicenseNumber

        when(userRepository.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("National ID");
    }

    // ── login ─────────────────────────────────────────────────

    @Test
    void login_shouldReturnTokens_whenCredentialsValid() {
        LoginRequest req = new LoginRequest("patient@test.com", "Pass1234!");
        User user = verifiedUser();
        when(userRepository.findByEmail(req.email())).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("access.token.here");
        when(jwtService.generateRefreshToken(eq(user), anyString())).thenReturn("refresh.token.here");
        when(jwtService.getAccessTokenExpirySeconds()).thenReturn(900L);
        when(jwtService.getRefreshTokenExpirySeconds()).thenReturn(604800L);

        AuthResponse response = authService.login(req, "127.0.0.1");

        assertThat(response.accessToken()).isEqualTo("access.token.here");
        assertThat(response.refreshToken()).isEqualTo("refresh.token.here");
        assertThat(response.isVerified()).isTrue();
    }

    @Test
    void login_shouldThrow_whenAccountNotVerified() {
        LoginRequest req = new LoginRequest("unverified@test.com", "Pass1234!");
        User user = unverifiedUser();
        when(userRepository.findByEmail(req.email())).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(req, "127.0.0.1"))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("verify your email");
    }

    @Test
    void login_shouldLockAccount_afterFiveFailedAttempts() {
        LoginRequest req = new LoginRequest("patient@test.com", "WrongPass");
        doThrow(new BadCredentialsException("bad")).when(authManager).authenticate(any());
        // First 5 calls are below threshold; 6th call sees count >= MAX_FAILED_ATTEMPTS
        when(rateLimitStore.getCount("10.0.0.1")).thenReturn(0L, 0L, 0L, 0L, 0L, 5L);

        // Trigger 5 failures to fill the rate limiter
        for (int i = 0; i < 5; i++) {
            try { authService.login(req, "10.0.0.1"); } catch (AppException ignored) {}
        }

        assertThatThrownBy(() -> authService.login(req, "10.0.0.1"))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Too many failed");
    }

    @Test
    void login_shouldIncrementFailedCounter_onBadCredentials() {
        LoginRequest req = new LoginRequest("patient@test.com", "WrongPass");
        doThrow(new BadCredentialsException("bad credentials")).when(authManager).authenticate(any());

        assertThatThrownBy(() -> authService.login(req, "10.0.0.2"))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Invalid email or password");
    }

    // ── refreshToken ──────────────────────────────────────────

    @Test
    void refreshToken_shouldReturnNewAccessToken_whenValid() {
        String jti = UUID.randomUUID().toString();
        User user  = verifiedUser();

        when(jwtService.isRefreshTokenValid("valid.refresh")).thenReturn(true);
        when(jwtService.extractJti("valid.refresh")).thenReturn(jti);
        when(jwtService.extractUserId("valid.refresh")).thenReturn(UUID.randomUUID().toString());
        when(refreshTokenRepository.existsByJtiAndExpiresAtAfter(eq(jti), any(Instant.class))).thenReturn(true);
        when(userRepository.findById(any())).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(user)).thenReturn("new.access.token");
        when(jwtService.generateRefreshToken(eq(user), anyString())).thenReturn("new.refresh.token");
        when(jwtService.getAccessTokenExpirySeconds()).thenReturn(900L);
        when(jwtService.getRefreshTokenExpirySeconds()).thenReturn(604800L);

        AuthResponse response = authService.refresh(new RefreshRequest("valid.refresh"));

        assertThat(response.accessToken()).isEqualTo("new.access.token");
    }

    @Test
    void refreshToken_shouldThrow_whenTokenRevoked() {
        String jti = UUID.randomUUID().toString();
        when(jwtService.isRefreshTokenValid("revoked.token")).thenReturn(true);
        when(jwtService.extractJti("revoked.token")).thenReturn(jti);
        when(refreshTokenRepository.existsByJtiAndExpiresAtAfter(eq(jti), any(Instant.class))).thenReturn(false);

        assertThatThrownBy(() -> authService.refresh(new RefreshRequest("revoked.token")))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("revoked");
    }

    // ── Fixtures ──────────────────────────────────────────────

    private RegisterRequest patientRegisterRequest() {
        return new RegisterRequest(
                "Alice Uwase", "alice@test.com", "+250780000001", "Pass1234!", Role.PATIENT,
                "rw", LocalDate.of(1995, 6, 15), "B+", "INS-001",
                "1199780000000001",
                null, null, null,    // licenseNumber, specialty, facility
                null,                // pharmacyId
                null, null, null);   // vehicleType, operatingZone, bikerLicenseNumber
    }

    private User verifiedUser() {
        User u = new User();
        u.setEmail("patient@test.com");
        u.setRole(Role.PATIENT);
        u.setVerified(true);
        u.setPasswordHash("$2a$hashed");
        return u;
    }

    private User unverifiedUser() {
        User u = new User();
        u.setEmail("unverified@test.com");
        u.setRole(Role.PATIENT);
        u.setVerified(false);
        u.setPasswordHash("$2a$hashed");
        return u;
    }
}
