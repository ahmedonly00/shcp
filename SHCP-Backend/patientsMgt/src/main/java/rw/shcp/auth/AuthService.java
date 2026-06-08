package rw.shcp.auth;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.Nullable;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.auth.dto.*;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.pharmacy.Biker;
import rw.shcp.pharmacy.BikerRepository;
import rw.shcp.pharmacy.Pharmacist;
import rw.shcp.pharmacy.PharmacistRepository;
import rw.shcp.pharmacy.PharmacyRepository;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.PatientRepository;
import rw.shcp.users.repository.ProviderRepository;
import rw.shcp.users.repository.UserRepository;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private static final int  MAX_FAILED_ATTEMPTS  = 5;
    private static final long LOCKOUT_MINUTES      = 30L;
    private static final long OTP_TTL_SECONDS      = 15 * 60L; // 15 min
    private static final int  MAX_OTP_ATTEMPTS     = 5;
    private static final String OTP_ATTEMPTS_PREFIX = "otp:attempts:";

    private static final Duration RATE_WINDOW = Duration.ofMinutes(15);

    private final UserRepository         userRepository;
    private final PatientRepository      patientRepository;
    private final ProviderRepository     providerRepository;
    private final PharmacistRepository   pharmacistRepository;
    private final BikerRepository        bikerRepository;
    private final PharmacyRepository     pharmacyRepository;
    private final PasswordEncoder        passwordEncoder;
    private final JwtService             jwtService;
    private final OtpTokenRepository     otpTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailService           emailService;
    private final AuthenticationManager  authManager;
    private final RateLimitStore         rateLimitStore;
    private final StringRedisTemplate    redisTemplate;

    @Autowired(required = false)
    @Nullable
    private FirebaseAuth firebaseAuth;   // null when Google login is not configured

    // ── Register ──────────────────────────────────────────────

    @Transactional
    public String register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw AppException.conflict("Email address is already registered");
        }

        validateRoleFields(req);

        User user = new User();
        user.setName(req.name());
        user.setEmail(req.email());
        user.setPhone(req.phone());
        user.setRole(req.role());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setLanguagePref(req.languagePref() != null ? req.languagePref() : "rw");
        user.setVerified(false);
        userRepository.save(user);

        if (req.role() == Role.PATIENT) {
            Patient patient = new Patient();
            patient.setUser(user);
            patient.setDateOfBirth(req.dateOfBirth());
            patient.setBloodType(req.bloodType());
            patient.setInsuranceNumber(req.insuranceNumber());
            patient.setNationalId(req.nationalId());
            patientRepository.save(patient);
        } else if (req.role() == Role.PROVIDER) {
            Provider provider = new Provider();
            provider.setUser(user);
            provider.setLicenseNumber(req.licenseNumber().trim());
            provider.setSpecialty(req.specialty().trim());
            provider.setFacility(req.facility().trim());
            providerRepository.save(provider);
        } else if (req.role() == Role.PHARMACIST) {
            var pharmacy = pharmacyRepository.findById(req.pharmacyId())
                    .orElseThrow(() -> AppException.notFound("Pharmacy not found"));
            Pharmacist pharmacist = new Pharmacist();
            pharmacist.setUser(user);
            pharmacist.setPharmacy(pharmacy);
            pharmacistRepository.save(pharmacist);
        } else if (req.role() == Role.BIKER) {
            var pharmacy = pharmacyRepository.findById(req.pharmacyId())
                    .orElseThrow(() -> AppException.notFound("Pharmacy not found"));
            Biker biker = new Biker();
            biker.setUser(user);
            biker.setPharmacy(pharmacy);
            biker.setLicenseNumber(req.bikerLicenseNumber());
            biker.setVehicleType(req.vehicleType());
            biker.setOperatingZone(req.operatingZone());
            bikerRepository.save(biker);
        }

        String otp = generateOtp();
        persistOtp(user.getEmail(), "VERIFY", otp);
        emailService.sendOtp(user.getEmail(), user.getName(), otp);

        log.info("Registered new user: {} ({})", user.getEmail(), user.getRole());
        return "Registration successful. Please check your email for a verification code.";
    }

    // ── Verify email ──────────────────────────────────────────

    @Transactional
    public String verifyEmail(VerifyEmailRequest req) {
        checkOtpAttempts(req.email(), "VERIFY");

        OtpToken stored = otpTokenRepository.findByEmailAndType(req.email(), "VERIFY")
                .filter(o -> o.getExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> AppException.badRequest(
                        "Verification code has expired. Please request a new one."));

        if (!stored.getCode().equals(req.otp())) {
            incrementOtpAttempts(req.email(), "VERIFY");
            throw AppException.badRequest("Invalid verification code.");
        }

        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> AppException.notFound("User not found"));

        user.setVerified(true);
        userRepository.save(user);
        otpTokenRepository.deleteByEmailAndType(req.email(), "VERIFY");
        deleteOtpAttempts(req.email(), "VERIFY");

        log.info("Email verified for: {}", req.email());
        return "Email verified successfully. You can now log in.";
    }

    // ── Login ─────────────────────────────────────────────────

    @Transactional
    public AuthResponse login(LoginRequest req, String clientIp) {
        checkRateLimit(clientIp);

        userRepository.findByEmail(req.email()).ifPresent(u -> {
            if (!u.isAccountNonLocked()) {
                throw AppException.tooManyRequests(
                        "Account is locked due to too many failed attempts. Try again after " +
                        u.getLockedUntil().toLocalTime());
            }
        });

        try {
            authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.email(), req.password()));
        } catch (BadCredentialsException e) {
            long count = rateLimitStore.increment(clientIp, RATE_WINDOW);
            userRepository.findByEmail(req.email()).ifPresent(u -> {
                int attempts = u.getFailedLoginAttempts() + 1;
                u.setFailedLoginAttempts(attempts);
                if (attempts >= MAX_FAILED_ATTEMPTS) {
                    u.setLockedUntil(OffsetDateTime.now().plusMinutes(LOCKOUT_MINUTES));
                    log.warn("Account locked for {} after {} failed attempts", req.email(), attempts);
                }
                userRepository.save(u);
            });
            log.debug("Failed login from IP {} — rate count={}", clientIp, count);
            throw AppException.unauthorized("Invalid email or password");
        }

        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> AppException.notFound("User not found"));

        if (!user.isVerified()) {
            throw AppException.unauthorized("Please verify your email address before logging in.");
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        rateLimitStore.reset(clientIp);
        return issueTokens(user);
    }

    // ── Refresh token ─────────────────────────────────────────

    public AuthResponse refresh(RefreshRequest req) {
        String token = req.refreshToken();

        if (!jwtService.isRefreshTokenValid(token)) {
            throw AppException.unauthorized("Invalid or expired refresh token");
        }

        String jti = jwtService.extractJti(token);
        if (!refreshTokenRepository.existsByJtiAndExpiresAtAfter(jti, Instant.now())) {
            throw AppException.unauthorized("Refresh token has been revoked");
        }

        String userId = jwtService.extractUserId(token);
        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> AppException.notFound("User not found"));

        refreshTokenRepository.deleteById(jti);
        return issueTokens(user);
    }

    // ── Logout ────────────────────────────────────────────────

    public void logout(RefreshRequest req) {
        String token = req.refreshToken();
        if (!jwtService.isRefreshTokenValid(token)) return;

        String jti = jwtService.extractJti(token);
        refreshTokenRepository.deleteById(jti);
        log.info("User {} logged out", jwtService.extractUserId(token));
    }

    // ── Forgot password ───────────────────────────────────────

    @Transactional
    public String forgotPassword(ForgotPasswordRequest req) {
        userRepository.findByEmail(req.email()).ifPresent(user -> {
            String otp = generateOtp();
            persistOtp(user.getEmail(), "RESET", otp);
            emailService.sendPasswordResetOtp(user.getEmail(), user.getName(), otp);
        });
        return "If that email is registered, a password reset code has been sent.";
    }

    // ── Reset password ────────────────────────────────────────

    @Transactional
    public String resetPassword(ResetPasswordRequest req) {
        checkOtpAttempts(req.email(), "RESET");

        OtpToken stored = otpTokenRepository.findByEmailAndType(req.email(), "RESET")
                .filter(o -> o.getExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> AppException.badRequest(
                        "Reset code has expired. Please request a new one."));

        if (!stored.getCode().equals(req.otp())) {
            incrementOtpAttempts(req.email(), "RESET");
            throw AppException.badRequest("Invalid reset code.");
        }

        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> AppException.notFound("User not found"));

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        otpTokenRepository.deleteByEmailAndType(req.email(), "RESET");
        refreshTokenRepository.deleteByUserId(user.getUserId());
        deleteOtpAttempts(req.email(), "RESET");

        log.info("Password reset for: {}", req.email());
        return "Password reset successful. Please log in with your new password.";
    }

    // ── Google Sign-In ────────────────────────────────────────

    @Transactional
    public AuthResponse googleLogin(GoogleAuthRequest req) {
        if (firebaseAuth == null) {
            throw AppException.badRequest("Google login is not configured on this server");
        }

        FirebaseToken token;
        try {
            token = firebaseAuth.verifyIdToken(req.idToken());
        } catch (FirebaseAuthException e) {
            throw AppException.unauthorized("Invalid Google token: " + e.getMessage());
        }

        String email = token.getEmail();
        String name  = token.getName();
        String picture = (String) token.getClaims().get("picture");

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setEmail(email);
            u.setName(name != null && !name.isBlank() ? name : email.split("@")[0]);
            u.setRole(Role.PATIENT);
            // Random password hash — Google users cannot log in via password
            u.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            u.setVerified(true);
            u.setLanguagePref("en");
            if (picture != null) u.setProfilePictureUrl(picture);
            u = userRepository.save(u);

            Patient patient = new Patient();
            patient.setUser(u);
            patientRepository.save(patient);

            log.info("New Google user created: {} ({})", email, u.getUserId());
            return u;
        });

        // Ensure existing users are marked verified (edge case: registered via email, signing in via Google)
        if (!user.isVerified()) {
            user.setVerified(true);
            userRepository.save(user);
        }

        return issueTokens(user);
    }

    // ── Change password (authenticated) ───────────────────────

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("User not found"));

        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw AppException.badRequest("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        log.info("Password changed for user: {}", user.getEmail());
    }

    // ── Private helpers ───────────────────────────────────────

    private AuthResponse issueTokens(User user) {
        String jti          = UUID.randomUUID().toString();
        String accessToken  = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user, jti);

        RefreshToken rt = new RefreshToken();
        rt.setJti(jti);
        rt.setUserId(user.getUserId());
        rt.setExpiresAt(Instant.now().plusSeconds(jwtService.getRefreshTokenExpirySeconds()));
        refreshTokenRepository.save(rt);

        boolean profileComplete = computeProfileComplete(user);

        return AuthResponse.of(
                accessToken,
                refreshToken,
                jwtService.getAccessTokenExpirySeconds(),
                user.getUserId(),
                user.getEmail(),
                user.getRole().name(),
                user.isVerified(),
                profileComplete);
    }

    private boolean computeProfileComplete(User user) {
        if (user.getRole() != Role.PATIENT) return true;
        return patientRepository.findById(user.getUserId())
                .map(p -> p.getDateOfBirth() != null && p.getNationalId() != null)
                .orElse(true);
    }

    private void persistOtp(String email, String type, String code) {
        otpTokenRepository.deleteByEmailAndType(email, type);
        OtpToken otp = new OtpToken();
        otp.setEmail(email);
        otp.setType(type);
        otp.setCode(code);
        otp.setExpiresAt(Instant.now().plusSeconds(OTP_TTL_SECONDS));
        otpTokenRepository.save(otp);
    }

    private void checkRateLimit(String ip) {
        if (rateLimitStore.getCount(ip) >= MAX_FAILED_ATTEMPTS) {
            throw AppException.tooManyRequests(
                    "Too many failed login attempts. Try again in 15 minutes.");
        }
    }

    private String generateOtp() {
        return String.format("%06d", new SecureRandom().nextInt(1_000_000));
    }

    private void checkOtpAttempts(String email, String type) {
        String key = OTP_ATTEMPTS_PREFIX + type.toLowerCase() + ":" + email;
        try {
            String val = redisTemplate.opsForValue().get(key);
            if (val != null && Long.parseLong(val) >= MAX_OTP_ATTEMPTS) {
                otpTokenRepository.deleteByEmailAndType(email, type);
                redisTemplate.delete(key);
                throw AppException.tooManyRequests("Too many attempts. Request a new code.");
            }
        } catch (AppException ex) {
            throw ex;
        } catch (DataAccessException e) {
            log.warn("Redis unavailable — OTP attempt check skipped for email={}", email);
        }
    }

    private void incrementOtpAttempts(String email, String type) {
        String key = OTP_ATTEMPTS_PREFIX + type.toLowerCase() + ":" + email;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, OTP_TTL_SECONDS, TimeUnit.SECONDS);
            }
        } catch (DataAccessException e) {
            log.warn("Redis unavailable — OTP attempt increment skipped for email={}", email);
        }
    }

    private void deleteOtpAttempts(String email, String type) {
        try {
            redisTemplate.delete(OTP_ATTEMPTS_PREFIX + type.toLowerCase() + ":" + email);
        } catch (DataAccessException e) {
            log.warn("Redis unavailable — OTP attempt counter deletion skipped for email={}", email);
        }
    }

    private void validateRoleFields(RegisterRequest req) {
        if (req.role() == Role.PATIENT) {
            if (req.dateOfBirth() == null)
                throw AppException.badRequest("Date of birth is required for patient registration");
            if (req.nationalId() == null || req.nationalId().isBlank())
                throw AppException.badRequest("National ID is required for patient registration");
        }
        if (req.role() == Role.PROVIDER) {
            if (req.licenseNumber() == null || req.licenseNumber().isBlank())
                throw AppException.badRequest("License number is required for provider registration");
            if (req.specialty() == null || req.specialty().isBlank())
                throw AppException.badRequest("Specialty is required for provider registration");
            if (req.facility() == null || req.facility().isBlank())
                throw AppException.badRequest("Facility (hospital/clinic) is required for provider registration");
        }
        if (req.role() == Role.PHARMACIST) {
            if (req.pharmacyId() == null)
                throw AppException.badRequest("pharmacyId is required for pharmacist registration");
        }
        if (req.role() == Role.BIKER) {
            if (req.pharmacyId() == null)
                throw AppException.badRequest("pharmacyId is required for biker registration");
            if (req.vehicleType() == null || req.vehicleType().isBlank())
                throw AppException.badRequest("vehicleType is required for biker registration");
        }
    }
}
