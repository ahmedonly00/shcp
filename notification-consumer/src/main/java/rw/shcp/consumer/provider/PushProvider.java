package rw.shcp.consumer.provider;

import java.util.Map;

public interface PushProvider {
    void send(String deviceToken, String title, String body, Map<String, String> data);
}
