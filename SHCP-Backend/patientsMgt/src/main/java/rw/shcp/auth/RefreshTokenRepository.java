package rw.shcp.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {

    boolean existsByJtiAndExpiresAtAfter(String jti, Instant now);

    @Transactional
    void deleteByUserId(UUID userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM RefreshToken r WHERE r.expiresAt < :now")
    void deleteExpired(Instant now);
}
