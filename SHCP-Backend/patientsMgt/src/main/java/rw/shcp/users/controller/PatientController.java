package rw.shcp.users.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.storage.FileStorageService;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.users.dto.*;
import rw.shcp.users.service.PatientService;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/patients")
@RequiredArgsConstructor
@Tag(name = "Patients", description = "Patient profile, EHR, symptom history and appointments")
public class PatientController {

    private final PatientService patientService;
    private final FileStorageService fileStorageService;

    @GetMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Get own patient profile")
    public ResponseEntity<ApiResponse<PatientProfileDto>> getMyProfile() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(patientService.getMyProfile(userId)));
    }

    @PutMapping("/me")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Update own patient profile")
    public ResponseEntity<ApiResponse<PatientProfileDto>> updateMyProfile(
            @Valid @RequestBody UpdatePatientRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(patientService.updateMyProfile(userId, req)));
    }

    @GetMapping("/me/ehr")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Get own electronic health record")
    public ResponseEntity<ApiResponse<HealthRecordDto>> getMyEhr() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(patientService.getMyEhr(userId)));
    }

    @PutMapping("/me/ehr")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Update own electronic health record (partial — null fields are ignored)")
    public ResponseEntity<ApiResponse<HealthRecordDto>> updateMyEhr(
            @RequestBody UpdateEhrRequest req) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(patientService.updateMyEhr(userId, req)));
    }

    @PatchMapping("/me/vitals")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Update own vital signs in the EHR")
    public ResponseEntity<ApiResponse<HealthRecordDto>> updateVitals(@RequestBody String vitalsJson) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                patientService.updateMyEhr(userId, new UpdateEhrRequest(null, null, null, vitalsJson, null, null, null, null, null))));
    }

    @GetMapping("/me/health-goals")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Get own health goals")
    public ResponseEntity<ApiResponse<String>> getHealthGoals() {
        UUID userId = SecurityUtils.currentUserId();
        HealthRecordDto ehr = patientService.getMyEhr(userId);
        return ResponseEntity.ok(ApiResponse.ok(ehr.goals()));
    }

    @PutMapping("/me/health-goals")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Replace own health goals list")
    public ResponseEntity<ApiResponse<HealthRecordDto>> updateHealthGoals(@RequestBody String goalsJson) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                patientService.updateMyEhr(userId, new UpdateEhrRequest(null, null, null, null, null, null, null, goalsJson, null))));
    }

    @GetMapping("/me/activity")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Get own activity logs (last N days)")
    public ResponseEntity<ApiResponse<String>> getActivity() {
        UUID userId = SecurityUtils.currentUserId();
        HealthRecordDto ehr = patientService.getMyEhr(userId);
        return ResponseEntity.ok(ApiResponse.ok(ehr.activityLogs()));
    }

    @PostMapping("/me/activity")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Append a daily activity log entry")
    public ResponseEntity<ApiResponse<HealthRecordDto>> logActivity(@RequestBody String entryJson) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(patientService.appendActivityLog(userId, entryJson)));
    }

    @PostMapping(value = "/me/ehr/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Upload a file (PDF / image) and attach it to the EHR documents section")
    public ResponseEntity<ApiResponse<HealthRecordDto>> uploadEhrFile(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "title", required = false) String title,
            @RequestPart(value = "date",  required = false) String date) throws IOException {

        UUID userId = SecurityUtils.currentUserId();
        String storedName = fileStorageService.store(file, userId);
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : storedName;
        String fileUrl = "/api/patients/me/ehr/files/" + storedName;

        HealthRecordDto updated = patientService.appendDocument(userId, new DocumentEntryRequest(
                title != null && !title.isBlank() ? title : originalName,
                date  != null && !date.isBlank()  ? date  : java.time.LocalDate.now().toString(),
                fileUrl,
                storedName,
                file.getContentType()
        ));
        return ResponseEntity.ok(ApiResponse.ok(updated));
    }

    @GetMapping("/me/ehr/files/{filename}")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Download / view a previously uploaded EHR file")
    public ResponseEntity<Resource> downloadEhrFile(@PathVariable String filename) {
        UUID userId = SecurityUtils.currentUserId();
        Resource resource = fileStorageService.load(filename, userId);
        String contentType = detectContentType(filename);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }

    private String detectContentType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".pdf"))  return "application/pdf";
        if (lower.endsWith(".png"))  return "image/png";
        if (lower.endsWith(".gif"))  return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg"))  return "image/svg+xml";
        return "image/jpeg"; // default for jpg/jpeg/bmp/tiff
    }

    @GetMapping("/me/symptom-reports")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Get own AI symptom analysis history (paginated)")
    public ResponseEntity<ApiResponse<Page<SymptomReportSummaryDto>>> getMySymptomReports(
            @ParameterObject @PageableDefault(size = 10, sort = "createdAt") Pageable pageable) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                patientService.getMySymptomReports(userId, pageable)));
    }

    @GetMapping("/me/appointments")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Get own appointment history (paginated)")
    public ResponseEntity<ApiResponse<Page<AppointmentSummaryDto>>> getMyAppointments(
            @ParameterObject @PageableDefault(size = 10, sort = "scheduledAt") Pageable pageable) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                patientService.getMyAppointments(userId, pageable)));
    }
}
