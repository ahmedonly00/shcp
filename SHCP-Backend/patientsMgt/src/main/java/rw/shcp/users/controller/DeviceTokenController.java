package rw.shcp.users.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.UserRepository;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User account operations")
public class DeviceTokenController {

    private final UserRepository userRepository;

    public record DeviceTokenRequest(
            @NotBlank @Size(max = 500) String deviceToken) {
    }

    @PutMapping("/device-token")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Register or update the FCM device token for push notifications")
    public ResponseEntity<ApiResponse<Void>> updateDeviceToken(
            @Valid @RequestBody DeviceTokenRequest req) {

        User user = SecurityUtils.currentUser();
        user.setDeviceToken(req.deviceToken());
        userRepository.save(user);

        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @DeleteMapping("/device-token")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Deregister the FCM device token (e.g. on logout)")
    public ResponseEntity<ApiResponse<Void>> removeDeviceToken() {
        User user = SecurityUtils.currentUser();
        user.setDeviceToken(null);
        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
