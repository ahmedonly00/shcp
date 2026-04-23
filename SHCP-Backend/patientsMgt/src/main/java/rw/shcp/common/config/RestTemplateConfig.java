package rw.shcp.common.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
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
     * RestTemplate used exclusively for the Flask AI microservice.
     * <ul>
     *   <li>Connect timeout: 2 s</li>
     *   <li>Read timeout: configured via {@code ai-service.timeout-ms} (default 5 s)</li>
     *   <li>Jackson configured with {@code SNAKE_CASE} to match the Flask JSON contract.</li>
     * </ul>
     */
    @Bean("aiRestTemplate")
    public RestTemplate aiRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(timeoutMs);

        // Dedicated ObjectMapper with snake_case for the AI service JSON contract
        ObjectMapper snakeCaseMapper = new ObjectMapper()
                .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)
                .findAndRegisterModules();

        MappingJackson2HttpMessageConverter converter =
                new MappingJackson2HttpMessageConverter(snakeCaseMapper);

        RestTemplate tpl = new RestTemplate(factory);
        tpl.setMessageConverters(List.of(converter));
        return tpl;
    }
}
