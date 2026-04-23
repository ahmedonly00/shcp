package rw.shcp.consumer.config;

import org.springframework.amqp.rabbit.config.RetryInterceptorBuilder;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.retry.interceptor.RetryOperationsInterceptor;

/**
 * Retry policy: up to 3 attempts, exponential back-off 1s → 2s → 4s.
 * After exhaustion {@link AuditingDeadLetterRecoverer} writes a DEAD_LETTERED
 * audit record then nacks the message → routed to DLQ.
 */
@Configuration
public class RetryConfig {

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory              connectionFactory,
            MessageConverter               jsonMessageConverter,
            AuditingDeadLetterRecoverer    deadLetterRecoverer) {

        RetryOperationsInterceptor retryInterceptor =
                RetryInterceptorBuilder.stateless()
                        .maxAttempts(3)
                        .backOffOptions(1_000, 2.0, 8_000)
                        .recoverer(deadLetterRecoverer)
                        .build();

        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter);
        factory.setAdviceChain(retryInterceptor);
        factory.setDefaultRequeueRejected(false);
        return factory;
    }
}
