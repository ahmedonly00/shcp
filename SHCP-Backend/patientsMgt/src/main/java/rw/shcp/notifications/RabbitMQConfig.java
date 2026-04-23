package rw.shcp.notifications;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configures the backend as a RabbitMQ publisher.
 * Only the exchange is declared here — queue/binding declarations live
 * in the notification-consumer, which owns the consumer topology.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE = "shcp.health.exchange";

    @Bean
    TopicExchange healthExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Bean
    Jackson2JsonMessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory factory,
                                  Jackson2JsonMessageConverter converter) {
        RabbitTemplate tpl = new RabbitTemplate(factory);
        tpl.setMessageConverter(converter);
        return tpl;
    }
}
