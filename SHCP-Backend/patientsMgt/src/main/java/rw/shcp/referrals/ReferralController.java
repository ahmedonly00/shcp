package rw.shcp.referrals;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.referrals.dto.CreateReferralRequest;
import rw.shcp.referrals.dto.ReferralDto;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/referrals")
@RequiredArgsConstructor
public class ReferralController {

    private final ReferralService referralService;

    @PostMapping
    @PreAuthorize("hasRole('PROVIDER')")
    public ResponseEntity<ApiResponse<ReferralDto>> create(
            @Valid @RequestBody CreateReferralRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(referralService.create(SecurityUtils.currentUserId(), req)));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('PROVIDER')")
    public ResponseEntity<ApiResponse<List<ReferralDto>>> myReferrals() {
        return ResponseEntity.ok(ApiResponse.ok(
                referralService.myReferrals(SecurityUtils.currentUserId())));
    }

    @GetMapping("/incoming")
    @PreAuthorize("hasRole('PROVIDER')")
    public ResponseEntity<ApiResponse<List<ReferralDto>>> incoming() {
        return ResponseEntity.ok(ApiResponse.ok(
                referralService.incomingReferrals(SecurityUtils.currentUserId())));
    }

    @GetMapping("/patient/me")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<ApiResponse<List<ReferralDto>>> patientReferrals() {
        return ResponseEntity.ok(ApiResponse.ok(
                referralService.myPatientReferrals(SecurityUtils.currentUserId())));
    }

    @PatchMapping("/{referralId}/status")
    @PreAuthorize("hasRole('PROVIDER')")
    public ResponseEntity<ApiResponse<ReferralDto>> updateStatus(
            @PathVariable UUID referralId,
            @RequestParam String status) {
        return ResponseEntity.ok(ApiResponse.ok(
                referralService.updateStatus(referralId, SecurityUtils.currentUserId(), status)));
    }
}
