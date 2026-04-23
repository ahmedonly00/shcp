package rw.shcp.pharmacy;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.pharmacy.dto.DeliveryDto;

import java.util.UUID;

@RestController
@RequestMapping("/api/deliveries")
@RequiredArgsConstructor
@Tag(name = "Delivery Tracking", description = "Real-time delivery tracking — patients see where their medication is")
public class DeliveryTrackingController {

    private final DeliveryTrackingService trackingService;

    /**
     * Returns the patient's current in-progress delivery (ASSIGNED → ON_THE_WAY),
     * including the biker's last known GPS coordinates and the prescription delivery address.
     * Returns data: null when no active delivery exists.
     */
    @GetMapping("/tracking/active")
    @Operation(summary = "Get my current active delivery with tracking info (PATIENT only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> getActiveDelivery() {
        return ResponseEntity.ok(ApiResponse.ok(
                trackingService.getActiveDeliveryForPatient(SecurityUtils.currentUserId())
                        .orElse(null)));
    }

    /**
     * Returns full tracking detail for a specific delivery.
     * Patients can only access deliveries that belong to their own prescription.
     */
    @GetMapping("/{deliveryId}/tracking")
    @Operation(summary = "Get tracking detail for a specific delivery (PATIENT owner / PHARMACIST / ADMIN)")
    public ResponseEntity<ApiResponse<DeliveryDto>> getTracking(@PathVariable UUID deliveryId) {
        return ResponseEntity.ok(ApiResponse.ok(
                trackingService.getTracking(
                        deliveryId,
                        SecurityUtils.currentUserId(),
                        SecurityUtils.currentUser().getRole())));
    }
}
