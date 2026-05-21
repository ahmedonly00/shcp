package rw.shcp.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.util.List;

@Configuration
public class RestTemplateConfig {

    @Value("${ai-service.timeout-ms:5000}")
    private int timeoutMs;

    /**
     * Dedicated ObjectMapper for the Flask AI microservice JSON contract.
     * Uses SNAKE_CASE to match Flask's response keys (e.g. {@code detected_symptoms},
     * {@code explaining_factors}).  Exposed as a named bean so SymptomService can
     * also use it when storing {@code ai_raw_response}, keeping the stored JSON in
     * the same snake_case format that feedback_export.py reads.
     */
    @Bean("aiObjectMapper")
    public ObjectMapper aiObjectMapper() {
        return new ObjectMapper()
                .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .findAndRegisterModules()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    /**
     * RestTemplate used exclusively for the Flask AI microservice.
     * <ul>
     *   <li>Connect timeout: 5 s</li>
     *   <li>Read timeout: configured via {@code ai-service.timeout-ms} (default 10 s)</li>
     *   <li>Jackson configured with {@code SNAKE_CASE} to match the Flask JSON contract.</li>
     * </ul>
     */
    @Bean("aiRestTemplate")
    public RestTemplate aiRestTemplate(@Qualifier("aiObjectMapper") ObjectMapper aiObjectMapper) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(timeoutMs);

        MappingJackson2HttpMessageConverter converter =
                new MappingJackson2HttpMessageConverter(aiObjectMapper);

        RestTemplate tpl = new RestTemplate(factory);
        tpl.setMessageConverters(List.of(converter));
        return tpl;
    }
}
