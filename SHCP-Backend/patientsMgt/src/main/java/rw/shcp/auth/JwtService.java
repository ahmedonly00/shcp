package rw.shcp.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import rw.shcp.users.model.User;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

/**
 * Handles creation and validation of JWT access and refresh tokens.
 *
 * <p>Access tokens carry claims: {@code userId}, {@code email}, {@code role},
 * {@code isVerified}, {@code type=ACCESS}.</p>
 * <p>Refresh tokens carry: {@code userId}, {@code jti} (UUID), {@code type=REFRESH}.
 * The {@code jti} is the database lookup key used to whitelist the token (stored in PostgreSQL {@code refresh_tokens} table).</p>
 */
@Service
@Slf4j
public class JwtService {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.access-token-expiry}")
    private long accessTokenExpiry;   // seconds

    @Value("${jwt.refresh-token-expiry}")
    private long refreshTokenExpiry;  // seconds

    // ── Access token ──────────────────────────────────────────

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getEmail())
                .claims(Map.of(
                        "userId",     user.getUserId().toString(),
                        "email",      user.getEmail(),
                        "role",       user.getRole().name(),
                        "isVerified", user.isVerified(),
                        "type",       "ACCESS"
                ))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessTokenExpiry)))
                .signWith(signingKey())
                .compact();
    }

    // ── Refresh token ─────────────────────────────────────────

    /**
     * Generates a refresh token embedding the given {@code jti}.
     * The caller is responsible for persisting the jti in Redis.
     */
    public String generateRefreshToken(User user, String jti) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getEmail())
                .id(jti)
                .claims(Map.of(
                        "userId", user.getUserId().toString(),
                        "type",   "REFRESH"
                ))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(refreshTokenExpiry)))
                .signWith(signingKey())
                .compact();
    }

    // ── Claim extractors ──────────────────────────────────────

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractUserId(String token) {
        return extractAllClaims(token).get("userId", String.class);
    }

    public String extractJti(String token) {
        return extractAllClaims(token).getId();
    }

    public String extractType(String token) {
        return extractAllClaims(token).get("type", String.class);
    }

    // ── Validation ────────────────────────────────────────────

    /**
     * Validates token signature, expiry, and that it is an ACCESS token.
     * Does NOT check {@code isVerified} — the filter handles that.
     */
    public boolean isAccessTokenValid(String token) {
        try {
            Claims claims = extractAllClaims(token);
            return "ACCESS".equals(claims.get("type", String.class))
                    && claims.getExpiration().after(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid access token: {}", e.getMessage());
            return false;
        }
    }

    public boolean isRefreshTokenValid(String token) {
        try {
            Claims claims = extractAllClaims(token);
            return "REFRESH".equals(claims.get("type", String.class))
                    && claims.getExpiration().after(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid refresh token: {}", e.getMessage());
            return false;
        }
    }

    public long getRefreshTokenExpirySeconds() {
        return refreshTokenExpiry;
    }

    public long getAccessTokenExpirySeconds() {
        return accessTokenExpiry;
    }

    // ── Key ───────────────────────────────────────────────────

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtSecret));
    }
}
