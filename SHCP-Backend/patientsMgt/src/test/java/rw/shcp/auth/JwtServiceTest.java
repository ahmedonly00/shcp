package rw.shcp.auth;

import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import rw.shcp.common.enums.Role;
import rw.shcp.users.model.User;

import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    // 256-bit Base64-encoded test secret (32 bytes)
    private static final String SECRET = Base64.getEncoder()
            .encodeToString("shcp-test-secret-key-32-bytes!!!".getBytes());

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "jwtSecret",         SECRET);
        ReflectionTestUtils.setField(jwtService, "accessTokenExpiry",  900L);    // 15 min
        ReflectionTestUtils.setField(jwtService, "refreshTokenExpiry", 604800L); // 7 days
    }

    // ── generateAccessToken ───────────────────────────────────────────────────

    @Test
    void generateAccessToken_shouldContainUserIdEmailAndRole() {
        User user = buildUser();
        String token = jwtService.generateAccessToken(user);

        assertThat(token).isNotBlank();
        assertThat(jwtService.extractEmail(token)).isEqualTo(user.getEmail());
        assertThat(jwtService.extractUserId(token)).isEqualTo(user.getUserId().toString());
        assertThat(jwtService.extractType(token)).isEqualTo("ACCESS");
    }

    @Test
    void generateAccessToken_shouldBeValidAccessToken() {
        String token = jwtService.generateAccessToken(buildUser());
        assertThat(jwtService.isAccessTokenValid(token)).isTrue();
        assertThat(jwtService.isRefreshTokenValid(token)).isFalse();
    }

    // ── generateRefreshToken ──────────────────────────────────────────────────

    @Test
    void generateRefreshToken_shouldEmbedJti() {
        User user = buildUser();
        String jti = UUID.randomUUID().toString();
        String token = jwtService.generateRefreshToken(user, jti);

        assertThat(jwtService.extractJti(token)).isEqualTo(jti);
        assertThat(jwtService.extractType(token)).isEqualTo("REFRESH");
    }

    @Test
    void generateRefreshToken_shouldBeValidRefreshToken() {
        String jti   = UUID.randomUUID().toString();
        String token = jwtService.generateRefreshToken(buildUser(), jti);
        assertThat(jwtService.isRefreshTokenValid(token)).isTrue();
        assertThat(jwtService.isAccessTokenValid(token)).isFalse();
    }

    // ── expired token ─────────────────────────────────────────────────────────

    @Test
    void isAccessTokenValid_shouldReturnFalse_forExpiredToken() {
        // Set a -1 second expiry to force immediate expiration
        ReflectionTestUtils.setField(jwtService, "accessTokenExpiry", -1L);
        String token = jwtService.generateAccessToken(buildUser());
        assertThat(jwtService.isAccessTokenValid(token)).isFalse();
    }

    // ── tampered token ────────────────────────────────────────────────────────

    @Test
    void isAccessTokenValid_shouldReturnFalse_forTamperedToken() {
        String token   = jwtService.generateAccessToken(buildUser());
        String tampered = token + "tampered";
        assertThat(jwtService.isAccessTokenValid(tampered)).isFalse();
    }

    @Test
    void extractAllClaims_shouldThrow_forInvalidToken() {
        assertThatThrownBy(() -> jwtService.extractAllClaims("not.a.jwt"))
                .isInstanceOf(JwtException.class);
    }

    // ── expiry getters ────────────────────────────────────────────────────────

    @Test
    void getAccessTokenExpirySeconds_shouldReturn900() {
        assertThat(jwtService.getAccessTokenExpirySeconds()).isEqualTo(900L);
    }

    @Test
    void getRefreshTokenExpirySeconds_shouldReturn604800() {
        assertThat(jwtService.getRefreshTokenExpirySeconds()).isEqualTo(604800L);
    }

    // ── fixture ───────────────────────────────────────────────────────────────

    private User buildUser() {
        User u = new User();
        u.setUserId(UUID.randomUUID());
        u.setName("Test Provider");
        u.setEmail("provider@shcp.rw");
        u.setPhone("+250780000001");
        u.setRole(Role.PROVIDER);
        u.setVerified(true);
        return u;
    }
}
