package rw.shcp.pharmacy;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.pharmacy.dto.AddPharmacistRequest;
import rw.shcp.pharmacy.dto.CreatePharmacyRequest;
import rw.shcp.pharmacy.dto.NearestPharmacyDto;
import rw.shcp.pharmacy.dto.PharmacistProfileDto;
import rw.shcp.pharmacy.dto.PharmacyDto;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pharmacies")
@RequiredArgsConstructor
@Tag(name = "Pharmacies", description = "Pharmacy management")
public class PharmacyController {

    private final PharmacyService pharmacyService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','PROVIDER','PATIENT','PHARMACIST','BIKER')")
    @Operation(summary = "List all active pharmacies (public)")
    public ResponseEntity<ApiResponse<List<PharmacyDto>>> listActive() {
        return ResponseEntity.ok(ApiResponse.ok(pharmacyService.listActive()));
    }

    @GetMapping("/nearest")
    @PreAuthorize("hasAnyRole('ADMIN','PROVIDER')")
    @Operation(summary = "Find nearest pharmacies to a delivery location (PROVIDER/ADMIN only)")
    public ResponseEntity<ApiResponse<List<NearestPharmacyDto>>> findNearest(
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String sector,
            @RequestParam(required = false) String cell,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng,
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(ApiResponse.ok(
                pharmacyService.findNearest(district, sector, cell, lat, lng, limit)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PROVIDER','PATIENT','PHARMACIST','BIKER')")
    @Operation(summary = "Get pharmacy by ID (public)")
    public ResponseEntity<ApiResponse<PharmacyDto>> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(pharmacyService.getById(id)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create pharmacy (ADMIN only)")
    public ResponseEntity<ApiResponse<PharmacyDto>> create(
            @Valid @RequestBody CreatePharmacyRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(pharmacyService.create(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update pharmacy (ADMIN only)")
    public ResponseEntity<ApiResponse<PharmacyDto>> update(
            @PathVariable UUID id,
            @Valid @RequestBody CreatePharmacyRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(pharmacyService.update(id, req)));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Activate pharmacy (ADMIN only)")
    public ResponseEntity<ApiResponse<Void>> activate(@PathVariable UUID id) {
        pharmacyService.setActive(id, true);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Deactivate pharmacy (ADMIN only)")
    public ResponseEntity<ApiResponse<Void>> deactivate(@PathVariable UUID id) {
        pharmacyService.setActive(id, false);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/{id}/pharmacists")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List pharmacists for a pharmacy (ADMIN only)")
    public ResponseEntity<ApiResponse<List<PharmacistProfileDto>>> listPharmacists(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(pharmacyService.listPharmacists(id)));
    }

    @PostMapping("/{id}/pharmacists")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Add a pharmacist to a pharmacy (ADMIN only)")
    public ResponseEntity<ApiResponse<PharmacistProfileDto>> addPharmacist(
            @PathVariable UUID id,
            @Valid @RequestBody AddPharmacistRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(pharmacyService.addPharmacist(id, req)));
    }
}
