package rw.shcp.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import rw.shcp.common.response.ApiResponse;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

        @ExceptionHandler(AppException.class)
        public ResponseEntity<ApiResponse<?>> handleAppException(AppException ex, HttpServletRequest req) {
                log.warn("[{}] {} — {}", ex.getStatus(), req.getRequestURI(), ex.getMessage());
                return ResponseEntity.status(ex.getStatus())
                                .body(ApiResponse.fail(ex.getCode(), ex.getMessage()));
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<ApiResponse<?>> handleValidation(MethodArgumentNotValidException ex,
                        HttpServletRequest req) {
                Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                                .collect(Collectors.toMap(
                                                FieldError::getField,
                                                fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage()
                                                                : "invalid",
                                                (a, b) -> a));
                log.warn("Validation failed on {}: {}", req.getRequestURI(), fieldErrors);
                return ResponseEntity.badRequest()
                                .body(ApiResponse.fail("VALIDATION_ERROR", "Request validation failed", fieldErrors));
        }

        @ExceptionHandler(AuthenticationException.class)
        public ResponseEntity<ApiResponse<?>> handleAuthentication(AuthenticationException ex,
                        HttpServletRequest req) {
                log.warn("Auth failure on {}: {}", req.getRequestURI(), ex.getMessage());
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body(ApiResponse.fail("UNAUTHORIZED", "Authentication required"));
        }

        @ExceptionHandler(AccessDeniedException.class)
        public ResponseEntity<ApiResponse<?>> handleAccessDenied(AccessDeniedException ex,
                        HttpServletRequest req) {
                log.warn("Access denied on {}: {}", req.getRequestURI(), ex.getMessage());
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(ApiResponse.fail("FORBIDDEN",
                                                "You do not have permission to access this resource"));
        }

        @ExceptionHandler(HttpMessageNotReadableException.class)
        public ResponseEntity<ApiResponse<?>> handleBadBody(HttpMessageNotReadableException ex,
                        HttpServletRequest req) {
                log.warn("Unreadable request body on {}: {}", req.getRequestURI(), ex.getMessage());
                return ResponseEntity.badRequest()
                                .body(ApiResponse.fail("BAD_REQUEST", "Malformed or unreadable request body"));
        }

        @ExceptionHandler(MethodArgumentTypeMismatchException.class)
        public ResponseEntity<ApiResponse<?>> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                        HttpServletRequest req) {
                log.warn("Type mismatch on {}: param='{}' value='{}'",
                                req.getRequestURI(), ex.getName(), ex.getValue());
                return ResponseEntity.badRequest()
                                .body(ApiResponse.fail("BAD_REQUEST",
                                                "Invalid value '" + ex.getValue()
                                                + "' for path parameter '" + ex.getName() + "'"));
        }

        @ExceptionHandler(DataIntegrityViolationException.class)
        public ResponseEntity<ApiResponse<?>> handleDataIntegrity(DataIntegrityViolationException ex,
                        HttpServletRequest req) {
                log.warn("Data integrity violation on {}: {}", req.getRequestURI(), ex.getMostSpecificCause().getMessage());
                String msg = ex.getMostSpecificCause().getMessage();
                if (msg != null && msg.contains("no_double_booking")) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                        .body(ApiResponse.fail("CONFLICT", "This time slot is already booked"));
                }
                if (msg != null && msg.contains("no_overlapping_slots")) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                        .body(ApiResponse.fail("CONFLICT", "An overlapping slot already exists"));
                }
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(ApiResponse.fail("CONFLICT", "Data conflict — please try again"));
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<ApiResponse<?>> handleGeneric(Exception ex, HttpServletRequest req) {
                log.error("Unhandled exception on {}", req.getRequestURI(), ex);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body(ApiResponse.fail("INTERNAL_SERVER_ERROR", "An unexpected error occurred"));
        }
}
