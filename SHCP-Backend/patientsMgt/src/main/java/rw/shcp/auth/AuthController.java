package rw.shcp.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.auth.dto.*;
import rw.shcp.common.response.ApiResponse;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Register, login, token management, and password reset")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @Operation(summary = "Register a new user (PATIENT / PROVIDER / ADMIN)")
    public ResponseEntity<ApiResponse<String>> register(@Valid @RequestBody RegisterRequest req) {
        String message = authService.register(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(message));
    }

    @PostMapping("/verify-email")
    @Operation(summary = "Verify email with OTP sent during registration")
    public ResponseEntity<ApiResponse<String>> verifyEmail(
            @Valid @RequestBody VerifyEmailRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(authService.verifyEmail(req)));
    }

    @PostMapping("/login")
    @Operation(summary = "Login and receive JWT access + refresh tokens")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest httpReq) {
        String clientIp = resolveClientIp(httpReq);
        return ResponseEntity.ok(ApiResponse.ok(authService.login(req, clientIp)));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Exchange a valid refresh token for a new access token")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(
            @Valid @RequestBody RefreshRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(authService.refresh(req)));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke the refresh token (stateless logout)")
    public ResponseEntity<ApiResponse<String>> logout(@Valid @RequestBody RefreshRequest req) {
        authService.logout(req);
        return ResponseEntity.ok(ApiResponse.ok("Logged out successfully"));
    }

    @PostMapping("/forgot-password")
    @Operation(summary = "Request a password reset OTP by email")
    public ResponseEntity<ApiResponse<String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(authService.forgotPassword(req)));
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Reset password using OTP received by email")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(authService.resetPassword(req)));
    }

    @PostMapping("/google")
    @Operation(summary = "Sign in with Google — exchange a Firebase ID token for SHCP JWT tokens")
    public ResponseEntity<ApiResponse<AuthResponse>> googleLogin(
            @Valid @RequestBody GoogleAuthRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(authService.googleLogin(req)));
    }

    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Change password for the currently authenticated user")
    public ResponseEntity<ApiResponse<String>> changePassword(
            @Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(SecurityUtils.currentUserId(), req);
        return ResponseEntity.ok(ApiResponse.ok("Password changed successfully"));
    }

    // ── Helpers ───────────────────────────────────────────────

    /**
     * Extracts the real client IP, respecting X-Forwarded-For from reverse proxies.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
