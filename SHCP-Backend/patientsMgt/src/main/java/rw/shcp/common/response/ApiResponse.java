package rw.shcp.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

public record ApiResponse<T>(
        boolean success,
        T data,
        @JsonInclude(JsonInclude.Include.NON_NULL) ErrorBody error,
        String timestamp
) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, Instant.now().toString());
    }

    public static <T> ApiResponse<T> fail(String code, String message) {
        return new ApiResponse<>(false, null, new ErrorBody(code, message, null), Instant.now().toString());
    }

    public static <T> ApiResponse<T> fail(String code, String message, Object details) {
        return new ApiResponse<>(false, null, new ErrorBody(code, message, details), Instant.now().toString());
    }

    public record ErrorBody(String code, String message,
                            @JsonInclude(JsonInclude.Include.NON_NULL) Object details) {}
}
