package rw.shcp.common;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import rw.shcp.auth.JwtService;

import static org.mockito.Mockito.mock;

/**
 * Test-only security config: disables CSRF, authentication, and JWT filter.
 * Import this in {@code @WebMvcTest} classes to focus tests on HTTP mapping
 * and business logic without needing valid JWTs.
 *
 * <p>Method-level security ({@code @PreAuthorize}) is still active — tests must
 * set up the {@link org.springframework.security.core.context.SecurityContextHolder}
 * with an appropriate principal before calling secured methods.</p>
 */
@TestConfiguration
@EnableMethodSecurity
public class TestSecurityConfig {

    @Bean
    public SecurityFilterChain testFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    /** Satisfies JwtAuthFilter's constructor dependency in @WebMvcTest slices. */
    @Bean
    public JwtService jwtService() {
        return mock(JwtService.class);
    }
}
