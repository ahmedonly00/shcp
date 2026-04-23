package rw.shcp.pharmacy;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import rw.shcp.common.enums.BikerStatus;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.pharmacy.dto.BikerDto;
import rw.shcp.pharmacy.dto.DeliveryDto;
import rw.shcp.pharmacy.dto.LocationUpdateRequest;
import rw.shcp.pharmacy.dto.UpdateDeliveryStatusRequest;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/biker")
@RequiredArgsConstructor
@Tag(name = "Biker", description = "Biker dashboard — order management and delivery status updates")
public class BikerController {

    private final BikerService bikerService;

    @GetMapping("/me")
    @Operation(summary = "Get my biker profile (BIKER only)")
    public ResponseEntity<ApiResponse<BikerDto>> getMyProfile() {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.getMyProfile(SecurityUtils.currentUserId())));
    }

    @PatchMapping("/me/status")
    @Operation(summary = "Update my availability status (BIKER only)")
    public ResponseEntity<ApiResponse<BikerDto>> updateStatus(@RequestParam BikerStatus status) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.setStatus(SecurityUtils.currentUserId(), status)));
    }

    @GetMapping("/orders")
    @Operation(summary = "List my assigned delivery orders (BIKER only)")
    public ResponseEntity<ApiResponse<List<DeliveryDto>>> myOrders() {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.getMyOrders(SecurityUtils.currentUserId())));
    }

    @GetMapping("/orders/{deliveryId}")
    @Operation(summary = "Get order detail (BIKER only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> getOrder(@PathVariable UUID deliveryId) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.getOrderById(deliveryId, SecurityUtils.currentUserId())));
    }

    @PostMapping("/orders/{deliveryId}/accept")
    @Operation(summary = "Accept an assigned delivery order (BIKER only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> accept(@PathVariable UUID deliveryId) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.accept(deliveryId, SecurityUtils.currentUserId())));
    }

    @PostMapping("/orders/{deliveryId}/decline")
    @Operation(summary = "Decline an assigned delivery order (BIKER only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> decline(@PathVariable UUID deliveryId) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.decline(deliveryId, SecurityUtils.currentUserId())));
    }

    @PostMapping("/orders/{deliveryId}/picked-up")
    @Operation(summary = "Mark order as picked up from pharmacy (BIKER only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> markPickedUp(@PathVariable UUID deliveryId) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.markPickedUp(deliveryId, SecurityUtils.currentUserId())));
    }

    @PostMapping("/orders/{deliveryId}/on-the-way")
    @Operation(summary = "Mark order as in transit (BIKER only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> markOnTheWay(@PathVariable UUID deliveryId) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.markOnTheWay(deliveryId, SecurityUtils.currentUserId())));
    }

    @PostMapping(value = "/orders/{deliveryId}/delivered",
                 consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Mark order as delivered with optional confirmation photo (BIKER only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> markDelivered(
            @PathVariable UUID deliveryId,
            @RequestPart(required = false) MultipartFile photo) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.markDelivered(deliveryId, SecurityUtils.currentUserId(), photo)));
    }

    @PatchMapping("/orders/{deliveryId}/location")
    @Operation(summary = "Push current GPS coordinates for an active delivery (BIKER only)")
    public ResponseEntity<Void> updateLocation(
            @PathVariable UUID deliveryId,
            @RequestBody LocationUpdateRequest req) {
        bikerService.updateLocation(deliveryId, SecurityUtils.currentUserId(),
                req.latitude(), req.longitude());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/orders/{deliveryId}/failed")
    @Operation(summary = "Mark delivery as failed (BIKER only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> markFailed(
            @PathVariable UUID deliveryId,
            @Valid @RequestBody UpdateDeliveryStatusRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                bikerService.markFailed(deliveryId, SecurityUtils.currentUserId(), req)));
    }
}
