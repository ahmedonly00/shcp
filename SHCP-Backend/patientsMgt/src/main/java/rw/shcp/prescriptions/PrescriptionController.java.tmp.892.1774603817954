package rw.shcp.prescriptions;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.prescriptions.dto.IssuePrescriptionRequest;
import rw.shcp.prescriptions.dto.PrescriptionDto;
import rw.shcp.users.model.User;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/prescriptions")
@RequiredArgsConstructor
@Tag(name = "Prescriptions", description = "Issue and manage patient prescriptions")
public class PrescriptionController {

        private final PrescriptionService prescriptionService;

        @PostMapping
        @Operation(summary = "Issue a prescription (PROVIDER only)")
        public ResponseEntity<ApiResponse<PrescriptionDto>> issue(
                        @Valid @RequestBody IssuePrescriptionRequest req) {
                UUID providerId = SecurityUtils.currentUserId();
                return ResponseEntity.status(HttpStatus.CREATED)
                                .body(ApiResponse.ok(prescriptionService.issue(providerId, req)));
        }

        @GetMapping("/{id}")
        @Operation(summary = "Get prescription by ID")
        public ResponseEntity<ApiResponse<PrescriptionDto>> getById(
                        @PathVariable UUID id) {
                User user = SecurityUtils.currentUser();
                return ResponseEntity.ok(ApiResponse.ok(
                                prescriptionService.getById(id, user.getUserId(), user.getRole())));
        }

        @GetMapping("/consultation/{consultationId}")
        @Operation(summary = "List prescriptions for a consultation")
        public ResponseEntity<ApiResponse<List<PrescriptionDto>>> getByConsultation(
                        @PathVariable UUID consultationId) {
                User user = SecurityUtils.currentUser();
                return ResponseEntity.ok(ApiResponse.ok(
                                prescriptionService.getByConsultation(
                                                consultationId, user.getUserId(), user.getRole())));
        }

        @GetMapping("/me")
        @Operation(summary = "List my prescriptions (patient sees own; provider sees issued)")
        public ResponseEntity<ApiResponse<List<PrescriptionDto>>> getMine() {
                User user = SecurityUtils.currentUser();
                return ResponseEntity.ok(ApiResponse.ok(
                                prescriptionService.getMyPrescriptions(user.getUserId(), user.getRole())));
        }

        @PutMapping("/{id}/cancel")
        @Operation(summary = "Cancel a prescription (PROVIDER only, own prescriptions)")
        public ResponseEntity<ApiResponse<PrescriptionDto>> cancel(
                        @PathVariable UUID id) {
                UUID providerId = SecurityUtils.currentUserId();
                return ResponseEntity.ok(ApiResponse.ok(
                                prescriptionService.cancel(id, providerId)));
        }

        @PostMapping("/{id}/notify-pharmacy")
        @Operation(summary = "Notify pharmacy to dispense a prescription (PROVIDER only)")
        public ResponseEntity<ApiResponse<PrescriptionDto>> notifyPharmacy(
                        @PathVariable UUID id) {
                UUID providerId = SecurityUtils.currentUserId();
                return ResponseEntity.ok(ApiResponse.ok(
                                prescriptionService.notifyPharmacy(id, providerId)));
        }
}
