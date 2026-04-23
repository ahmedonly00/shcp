package rw.shcp.consumer.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.amqp.support.converter.DefaultJackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Declares the same exchange, queues, and bindings as the core API.
 * Spring AMQP is idempotent — re-declaring existing queues is safe.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE    = "shcp.health.exchange";
    public static final String QUEUE_EMAIL = "shcp.notifications.email";
    public static final String QUEUE_PUSH  = "shcp.notifications.push";
    public static final String QUEUE_DLQ   = "shcp.notifications.dlq";

    @Bean TopicExchange healthExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE).durable(true).build();
    }

    @Bean Queue emailQueue() {
        return QueueBuilder.durable(QUEUE_EMAIL)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", QUEUE_DLQ)
                .build();
    }

    @Bean Queue pushQueue() {
        return QueueBuilder.durable(QUEUE_PUSH)
                .withArgument("x-dead-letter-exchange", "")
                .withArgument("x-dead-letter-routing-key", QUEUE_DLQ)
                .build();
    }

    @Bean Queue deadLetterQueue() {
        return QueueBuilder.durable(QUEUE_DLQ).build();
    }

    @Bean Binding emailBinding(TopicExchange healthExchange) {
        return BindingBuilder.bind(emailQueue()).to(healthExchange).with("notification.email.#");
    }

    @Bean Binding pushBinding(TopicExchange healthExchange) {
        return BindingBuilder.bind(pushQueue()).to(healthExchange).with("notification.push.#");
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        // Use the @RabbitListener method-parameter type instead of the __TypeId__ header.
        // The publisher lives in a different package so its class name is not on our classpath.
        DefaultJackson2JavaTypeMapper typeMapper = new DefaultJackson2JavaTypeMapper();
        typeMapper.setTypePrecedence(Jackson2JavaTypeMapper.TypePrecedence.INFERRED);
        converter.setJavaTypeMapper(typeMapper);
        return converter;
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory factory) {
        RabbitTemplate tpl = new RabbitTemplate(factory);
        tpl.setMessageConverter(jsonMessageConverter());
        return tpl;
    }
}
