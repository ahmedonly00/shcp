package rw.shcp.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Redis configuration — used exclusively for IP rate limiting via
 * {@link rw.shcp.auth.RateLimitStore}.
 *
 * Connection details (host, port, password) come from
 * {@code spring.data.redis.*} in {@code application.yml}.
 * Lettuce is the driver; Spring Boot auto-configures the
 * {@link RedisConnectionFactory} from those properties.
 */
@Configuration
public class RedisConfig {

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        return new StringRedisTemplate(factory);
    }
}
