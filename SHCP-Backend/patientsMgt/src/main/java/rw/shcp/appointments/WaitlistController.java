package rw.shcp.appointments;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.appointments.dto.JoinWaitlistRequest;
import rw.shcp.appointments.dto.WaitlistDto;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/waitlist")
@RequiredArgsConstructor
public class WaitlistController {

    private final WaitlistService waitlistService;

    @PostMapping
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<ApiResponse<WaitlistDto>> join(
            @Valid @RequestBody JoinWaitlistRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(waitlistService.join(SecurityUtils.currentUserId(), req)));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<ApiResponse<List<WaitlistDto>>> myEntries() {
        return ResponseEntity.ok(ApiResponse.ok(
                waitlistService.myEntries(SecurityUtils.currentUserId())));
    }

    @DeleteMapping("/{entryId}")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<ApiResponse<Void>> leave(@PathVariable UUID entryId) {
        waitlistService.leave(SecurityUtils.currentUserId(), entryId);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
