package rw.shcp.consultations;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.consultations.dto.*;
import rw.shcp.users.model.User;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
@Tag(name = "Consultations", description = "Start, end and view video consultations")
public class ConsultationController {

    private final ConsultationService consultationService;

    // ── Core lifecycle ────────────────────────────────────────────────────────

    @PostMapping("/instant")
    @Operation(summary = "Start an instant consultation now (PATIENT only — no pre-booked slot required)")
    public ResponseEntity<ApiResponse<ConsultationDto>> startInstant(
            @Valid @RequestBody InstantConsultRequest req) {
        UUID patientId = SecurityUtils.currentUserId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(consultationService.startInstant(patientId, req)));
    }

    @GetMapping("/instant-incoming")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Get the active incoming instant consultation for this provider (PROVIDER only)")
    public ResponseEntity<ApiResponse<ConsultationDto>> getIncomingInstant() {
        UUID providerId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(consultationService.getIncomingInstant(providerId)));
    }

    @PostMapping
    @Operation(summary = "Start a consultation (PROVIDER only)")
    public ResponseEntity<ApiResponse<ConsultationDto>> start(
            @Valid @RequestBody StartConsultationRequest req) {
        UUID providerId = SecurityUtils.currentUserId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(consultationService.start(providerId, req)));
    }

    @PutMapping("/{id}/end")
    @Operation(summary = "End an in-progress consultation (PROVIDER only)")
    public ResponseEntity<ApiResponse<ConsultationDto>> end(
            @PathVariable UUID id,
            @Valid @RequestBody EndConsultationRequest req) {
        UUID providerId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.end(id, providerId, req)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get consultation by ID")
    public ResponseEntity<ApiResponse<ConsultationDto>> getById(
            @PathVariable UUID id) {
        User user = SecurityUtils.currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.getById(id, user.getUserId(), user.getRole())));
    }

    @GetMapping("/appointment/{appointmentId}")
    @Operation(summary = "Get consultation for a specific appointment")
    public ResponseEntity<ApiResponse<ConsultationDto>> getByAppointment(
            @PathVariable UUID appointmentId) {
        User user = SecurityUtils.currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.getByAppointment(
                        appointmentId, user.getUserId(), user.getRole())));
    }

    @GetMapping("/me")
    @Operation(summary = "List my consultations (patient or provider)")
    public ResponseEntity<ApiResponse<List<ConsultationDto>>> getMine() {
        User user = SecurityUtils.currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.getMyConsultations(user.getUserId(), user.getRole())));
    }

    // ── Audit log ─────────────────────────────────────────────────────────────

    @PostMapping("/{id}/audit")
    @Operation(summary = "Log a call lifecycle event (PATIENT or PROVIDER)")
    public ResponseEntity<Void> logAuditEvent(
            @PathVariable UUID id,
            @Valid @RequestBody LogAuditRequest req,
            HttpServletRequest httpRequest) {
        User user = SecurityUtils.currentUser();
        String ip = httpRequest.getRemoteAddr();
        consultationService.logClientAuditEvent(id, user.getUserId(), user.getRole(), req, ip);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/audit")
    @Operation(summary = "Get audit log for a consultation (PROVIDER or ADMIN)")
    public ResponseEntity<ApiResponse<List<AuditEventDto>>> getAuditLog(
            @PathVariable UUID id) {
        User user = SecurityUtils.currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.getAuditLog(id, user.getUserId(), user.getRole())));
    }

    // ── Recording consent ─────────────────────────────────────────────────────

    @PostMapping("/{id}/consent")
    @Operation(summary = "Patient grants consent to record this consultation")
    public ResponseEntity<ApiResponse<ConsultationDto>> grantConsent(
            @PathVariable UUID id) {
        UUID patientId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.grantRecordingConsent(id, patientId)));
    }

    // ── Recording upload ──────────────────────────────────────────────────────

    @PostMapping(value = "/{id}/recording", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload the recording for a consultation")
    public ResponseEntity<ApiResponse<ConsultationDto>> uploadRecording(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) throws IOException {
        User user = SecurityUtils.currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.uploadRecording(id, user.getUserId(), user.getRole(), file)));
    }

    // ── Recording download ────────────────────────────────────────────────────

    @GetMapping("/{id}/recording")
    @Operation(summary = "Download the recording for a consultation (PATIENT or PROVIDER)")
    public ResponseEntity<Resource> getRecording(@PathVariable UUID id) {
        User user = SecurityUtils.currentUser();
        Resource resource = consultationService.getRecording(id, user.getUserId(), user.getRole());

        String filename = resource.getFilename() != null ? resource.getFilename() : "recording";
        MediaType mediaType = filename.endsWith(".mp4") ? MediaType.parseMediaType("video/mp4")
                : filename.endsWith(".ogg") ? MediaType.parseMediaType("video/ogg")
                : MediaType.parseMediaType("video/webm");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(mediaType)
                .body(resource);
    }

    // ── TURN credentials ──────────────────────────────────────────────────────

    @GetMapping("/{id}/turn-credentials")
    @Operation(summary = "Get time-limited TURN server credentials for a consultation")
    public ResponseEntity<ApiResponse<TurnCredentialsDto>> getTurnCredentials(
            @PathVariable UUID id) {
        User user = SecurityUtils.currentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                consultationService.getTurnCredentials(id, user.getUserId(), user.getRole())));
    }
}
