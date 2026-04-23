package rw.shcp.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Primary ObjectMapper bean used throughout the application.
 * Registers Java 8 date/time types and disables timestamp serialization
 * so dates are written as ISO-8601 strings.
 */
@Configuration
public class JacksonConfig {

    @Bean
    @Primary
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .findAndRegisterModules()          // picks up ParameterNamesModule, JavaTimeModule, etc.
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }
}
