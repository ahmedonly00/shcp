package rw.shcp.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import rw.shcp.auth.dto.*;
import rw.shcp.common.TestSecurityConfig;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(TestSecurityConfig.class)
class AuthControllerTest {

    @Autowired MockMvc      mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean AuthService authService;

    // ── POST /api/auth/register ────────────────────────────────────────────────

    @Test
    void register_shouldReturn201_onValidRequest() throws Exception {
        when(authService.register(any(RegisterRequest.class))).thenReturn("User registered successfully");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {
                              "name": "Alice",
                              "email": "alice@shcp.rw",
                              "phone": "+250780000001",
                              "password": "SecurePass1!",
                              "role": "PATIENT",
                              "languagePref": "en"
                            }
                            """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void register_shouldReturn400_whenEmailMissing() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "name": "Alice", "password": "pass", "role": "PATIENT" }
                            """))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────────

    @Test
    void login_shouldReturn200_andAuthResponse() throws Exception {
        AuthResponse authResponse = AuthResponse.of(
                "access-token", "refresh-token", 900L, null, "alice@shcp.rw", "PATIENT", true, true);
        when(authService.login(any(LoginRequest.class), any())).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "email": "alice@shcp.rw", "password": "SecurePass1!" }
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("access-token"))
                .andExpect(jsonPath("$.data.refreshToken").value("refresh-token"));
    }

    @Test
    void login_shouldReturn400_whenEmailBlank() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "email": "", "password": "pass" }
                            """))
                .andExpect(status().isBadRequest());
    }

    // ── POST /api/auth/refresh ────────────────────────────────────────────────

    @Test
    void refresh_shouldReturn200_andNewTokenPair() throws Exception {
        AuthResponse authResponse = AuthResponse.of(
                "new-access", "new-refresh", 900L, null, "alice@shcp.rw", "PATIENT", true, true);
        when(authService.refresh(any(RefreshRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "refreshToken": "some-refresh-token" }
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("new-access"));
    }

    // ── POST /api/auth/verify-email ───────────────────────────────────────────

    @Test
    void verifyEmail_shouldReturn200_onSuccess() throws Exception {
        when(authService.verifyEmail(any(VerifyEmailRequest.class))).thenReturn("Email verified successfully");

        mockMvc.perform(post("/api/auth/verify-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "email": "alice@shcp.rw", "otp": "123456" }
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    // ── POST /api/auth/logout ─────────────────────────────────────────────────

    @Test
    void logout_shouldReturn200() throws Exception {
        doNothing().when(authService).logout(any(RefreshRequest.class));

        mockMvc.perform(post("/api/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "refreshToken": "some-refresh-token" }
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
