package rw.shcp.consumer.provider;

public interface EmailProvider {
    void send(String to, String subject, String body);
}
