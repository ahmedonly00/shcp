package rw.shcp.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Redis-backed IP rate limiter for authentication endpoints.
 *
 * <p>Key layout:
 * <pre>
 *   rate_limit:{ip}   → failure count (integer string), TTL = rate window
 * </pre>
 * The TTL is set on the first increment so the window slides from
 * the first failure. The key self-destructs after the window expires,
 * automatically resetting the counter without a scheduled cleanup job.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitStore {

    private static final String PREFIX = "rate_limit:";

    private final StringRedisTemplate redis;

    /**
     * Increments the failure counter for the IP and returns the new count.
     * The window TTL is set on the first increment only.
     */
    public long increment(String ip, Duration window) {
        try {
            String key = PREFIX + ip;
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redis.expire(key, window);
            }
            return count != null ? count : 1L;
        } catch (DataAccessException e) {
            log.warn("Redis unavailable — rate limit increment skipped for ip={}", ip);
            return 0L; // fail-open: don't block the request
        }
    }

    /** Returns the current failure count (0 if the window has expired or Redis is down). */
    public long getCount(String ip) {
        try {
            String val = redis.opsForValue().get(PREFIX + ip);
            return val == null ? 0L : Long.parseLong(val);
        } catch (DataAccessException e) {
            log.warn("Redis unavailable — rate limit check skipped for ip={}", ip);
            return 0L; // fail-open: allow the request through
        }
    }

    /** Clears the rate limit counter for an IP (e.g. on successful login). */
    public void reset(String ip) {
        try {
            redis.delete(PREFIX + ip);
        } catch (DataAccessException e) {
            log.warn("Redis unavailable — rate limit reset skipped for ip={}", ip);
        }
    }
}
