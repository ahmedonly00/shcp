package rw.shcp.pharmacy;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.pharmacy.dto.*;
import rw.shcp.pharmacy.dto.InventoryItemDto;
import rw.shcp.pharmacy.dto.StockUpdateRequest;
import rw.shcp.prescriptions.dto.PrescriptionDto;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pharmacist")
@RequiredArgsConstructor
@Tag(name = "Pharmacist", description = "Pharmacist dashboard — prescriptions, bikers, deliveries")
public class PharmacistController {

    private final PharmacistService pharmacistService;

    // ── Prescriptions ─────────────────────────────────────────────────────────

    @GetMapping("/prescriptions")
    @Operation(summary = "List all prescriptions assigned to my pharmacy (PHARMACIST only)")
    public ResponseEntity<ApiResponse<List<PrescriptionDto>>> myPrescriptions() {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.getMyPrescriptions(SecurityUtils.currentUserId())));
    }

    @PatchMapping("/prescriptions/{id}/processing")
    @Operation(summary = "Mark prescription as PROCESSING (PHARMACIST only)")
    public ResponseEntity<ApiResponse<PrescriptionDto>> markProcessing(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.markProcessing(id, SecurityUtils.currentUserId())));
    }

    @PatchMapping("/prescriptions/{id}/ready")
    @Operation(summary = "Mark prescription as READY_FOR_DELIVERY (PHARMACIST only)")
    public ResponseEntity<ApiResponse<PrescriptionDto>> markReady(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.markReadyForDelivery(id, SecurityUtils.currentUserId())));
    }

    @GetMapping("/prescriptions/{id}/suggested-bikers")
    @Operation(summary = "List available bikers ranked by zone match for this prescription (PHARMACIST only)")
    public ResponseEntity<ApiResponse<List<BikerDto>>> suggestedBikers(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.getSuggestedBikers(id, SecurityUtils.currentUserId())));
    }

    @PostMapping("/prescriptions/{id}/assign-biker")
    @Operation(summary = "Assign a biker to deliver this prescription (PHARMACIST only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> assignBiker(
            @PathVariable UUID id,
            @Valid @RequestBody AssignBikerRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                pharmacistService.assignBiker(id, SecurityUtils.currentUserId(), req)));
    }

    // ── Deliveries ────────────────────────────────────────────────────────────

    @GetMapping("/deliveries")
    @Operation(summary = "List all deliveries for my pharmacy (PHARMACIST only)")
    public ResponseEntity<ApiResponse<List<DeliveryDto>>> myDeliveries() {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.getMyDeliveries(SecurityUtils.currentUserId())));
    }

    @PostMapping("/deliveries/{deliveryId}/reassign")
    @Operation(summary = "Reassign a declined/failed delivery to another biker (PHARMACIST only)")
    public ResponseEntity<ApiResponse<DeliveryDto>> reassign(
            @PathVariable UUID deliveryId,
            @Valid @RequestBody AssignBikerRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.reassignBiker(deliveryId, SecurityUtils.currentUserId(), req)));
    }

    // ── Biker management ──────────────────────────────────────────────────────

    @GetMapping("/bikers")
    @Operation(summary = "List all bikers in my pharmacy team (PHARMACIST only)")
    public ResponseEntity<ApiResponse<List<BikerDto>>> myBikers() {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.getMyBikers(SecurityUtils.currentUserId())));
    }

    @PostMapping("/bikers")
    @Operation(summary = "Register a new biker for my pharmacy (PHARMACIST only)")
    public ResponseEntity<ApiResponse<BikerDto>> registerBiker(
            @Valid @RequestBody RegisterBikerRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(
                pharmacistService.registerBiker(SecurityUtils.currentUserId(), req)));
    }

    @PatchMapping("/bikers/{bikerId}/activate")
    @Operation(summary = "Activate a biker (PHARMACIST only)")
    public ResponseEntity<ApiResponse<BikerDto>> activateBiker(@PathVariable UUID bikerId) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.setBikerActive(bikerId, SecurityUtils.currentUserId(), true)));
    }

    @PatchMapping("/bikers/{bikerId}/deactivate")
    @Operation(summary = "Deactivate a biker (PHARMACIST only)")
    public ResponseEntity<ApiResponse<BikerDto>> deactivateBiker(@PathVariable UUID bikerId) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.setBikerActive(bikerId, SecurityUtils.currentUserId(), false)));
    }

    // ── Inventory management ──────────────────────────────────────────────────

    @GetMapping("/inventory")
    @Operation(summary = "List all inventory items for my pharmacy (PHARMACIST only)")
    public ResponseEntity<ApiResponse<List<InventoryItemDto>>> myInventory() {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.getMyInventory(SecurityUtils.currentUserId())));
    }

    @GetMapping("/inventory/low-stock")
    @Operation(summary = "List inventory items at or below their reorder level (PHARMACIST only)")
    public ResponseEntity<ApiResponse<List<InventoryItemDto>>> lowStockAlerts() {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.getLowStockAlerts(SecurityUtils.currentUserId())));
    }

    @PutMapping("/inventory")
    @Operation(summary = "Upsert a medication stock entry — creates or updates by medication name (PHARMACIST only)")
    public ResponseEntity<ApiResponse<InventoryItemDto>> upsertStock(
            @Valid @RequestBody StockUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacistService.upsertStock(SecurityUtils.currentUserId(), req)));
    }

    @DeleteMapping("/inventory/{inventoryId}")
    @Operation(summary = "Remove a medication from inventory (PHARMACIST only)")
    public ResponseEntity<Void> deleteInventoryItem(@PathVariable UUID inventoryId) {
        pharmacistService.deleteInventoryItem(inventoryId, SecurityUtils.currentUserId());
        return ResponseEntity.noContent().build();
    }
}
