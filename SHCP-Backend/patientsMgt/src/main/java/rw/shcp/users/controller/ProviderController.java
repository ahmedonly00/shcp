package rw.shcp.users.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.users.dto.*;
import rw.shcp.users.service.ProviderService;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/providers")
@RequiredArgsConstructor
@Tag(name = "Providers", description = "Provider profiles, availability and appointment management")
public class ProviderController {

    private final ProviderService providerService;

    // ── Public endpoints ──────────────────────────────────────

    @GetMapping
    @Operation(summary = "List all active providers (public)")
    public ResponseEntity<ApiResponse<Page<ProviderSummaryDto>>> listProviders(
            @ParameterObject @PageableDefault(size = 20, sort = "specialty") Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.getPublicProviders(pageable)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a provider's public profile")
    public ResponseEntity<ApiResponse<ProviderProfileDto>> getProfile(
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.getPublicProfile(id)));
    }

    @GetMapping("/{id}/availability")
    @Operation(summary = "Get a provider's available (unbooked future) slots, optionally filtered by date (yyyy-MM-dd)")
    public ResponseEntity<ApiResponse<List<AvailabilityDto>>> getAvailability(
            @PathVariable UUID id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(providerService.getProviderAvailability(id, date)));
    }

    // ── Provider-own endpoints ────────────────────────────────

    @GetMapping("/me")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Get own provider profile")
    public ResponseEntity<ApiResponse<ProviderProfileDto>> getMyProfile() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(providerService.getMyProfile(userId)));
    }

    @PutMapping("/me")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Update own provider profile")
    public ResponseEntity<ApiResponse<ProviderProfileDto>> updateMyProfile(
            @Valid @RequestBody UpdateProviderRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(providerService.updateMyProfile(userId, req)));
    }

    @PutMapping("/me/availability")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Replace own future availability slots (booked slots are preserved)")
    public ResponseEntity<ApiResponse<List<AvailabilityDto>>> setAvailability(
            @Valid @RequestBody SetAvailabilityRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(providerService.setMyAvailability(userId, req)));
    }

    @PostMapping("/me/availability/slots")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Add a single availability slot (non-destructive)")
    public ResponseEntity<ApiResponse<AvailabilityDto>> addSlot(
            @Valid @RequestBody SetAvailabilityRequest.SlotRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.ok(providerService.addSlot(userId, req)));
    }

    @GetMapping("/me/appointments")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Get own appointment list (paginated)")
    public ResponseEntity<ApiResponse<Page<AppointmentSummaryDto>>> getMyAppointments(
            @ParameterObject @PageableDefault(size = 10, sort = "scheduledAt") Pageable pageable) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                providerService.getMyAppointments(userId, pageable)));
    }

    @GetMapping("/me/patients")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Get all patients ever assigned to this provider")
    public ResponseEntity<ApiResponse<List<PatientSummaryDto>>> getMyPatients() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(providerService.getMyPatients(userId)));
    }

    @GetMapping("/me/patients/{patientId}/ehr")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Get a patient's electronic health record (providers only)")
    public ResponseEntity<ApiResponse<HealthRecordDto>> getPatientEhr(
            @PathVariable UUID patientId) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(providerService.getPatientEhr(userId, patientId)));
    }

    @GetMapping("/me/slots")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Get all own slots (available, booked, and blocked)")
    public ResponseEntity<ApiResponse<List<AvailabilityDto>>> getMySlots() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(providerService.getMySlots(userId)));
    }

    @PatchMapping("/me/availability/slots/{slotId}/block")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Toggle block/unblock an availability slot")
    public ResponseEntity<ApiResponse<AvailabilityDto>> blockSlot(
            @PathVariable UUID slotId) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(providerService.blockSlot(userId, slotId)));
    }

    @GetMapping("/me/availability/export.ics")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Export availability as iCal (.ics) file")
    public ResponseEntity<String> exportIcal() {
        UUID userId = SecurityUtils.currentUserId();
        String ical = providerService.exportIcal(userId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/calendar"));
        headers.setContentDispositionFormData("attachment", "availability.ics");
        return ResponseEntity.ok().headers(headers).body(ical);
    }
}
