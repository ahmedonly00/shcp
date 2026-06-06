package rw.shcp.analytics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.analytics.dto.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
@Tag(name = "Analytics", description = "Platform, provider, and patient analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @GetMapping("/admin/overview")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Platform-wide stats overview (ADMIN only)")
    public ResponseEntity<ApiResponse<PlatformStatsDto>> adminOverview() {
        return ResponseEntity.ok(ApiResponse.ok(analyticsService.platformOverview()));
    }

    @GetMapping("/admin/registrations")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "New user registrations per day (ADMIN only)")
    public ResponseEntity<ApiResponse<List<DailyCountDto>>> registrations(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.ok(
                analyticsService.registrationsPerDay(days)));
    }

    @GetMapping("/admin/appointments")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Appointment bookings per day (ADMIN only)")
    public ResponseEntity<ApiResponse<List<DailyCountDto>>> appointments(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.ok(
                analyticsService.appointmentsPerDay(days)));
    }

    // ── Admin export (FR7) ────────────────────────────────────────────────────

    @GetMapping(value = "/admin/export.csv", produces = "text/csv")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Export platform overview as CSV (ADMIN only)")
    public ResponseEntity<byte[]> exportPlatformCsv() {
        byte[] csv = analyticsService.exportPlatformCsv();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"platform-stats.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping(value = "/admin/appointments/export.csv", produces = "text/csv")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Export appointment time-series as CSV (ADMIN only)")
    public ResponseEntity<byte[]> exportAppointmentsCsv(
            @RequestParam(defaultValue = "30") int days) {
        byte[] csv = analyticsService.exportAppointmentsCsv(days);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"appointments.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping(value = "/admin/registrations/export.csv", produces = "text/csv")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Export registrations time-series as CSV (ADMIN only)")
    public ResponseEntity<byte[]> exportRegistrationsCsv(
            @RequestParam(defaultValue = "30") int days) {
        byte[] csv = analyticsService.exportRegistrationsCsv(days);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"registrations.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    // ── MOH Report Generator ──────────────────────────────────────────────────

    @GetMapping("/admin/report")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Generate MOH report preview (JSON) for a date range and selected metrics")
    public ResponseEntity<ApiResponse<ReportDataDto>> getMohReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<String> metrics) {
        return ResponseEntity.ok(ApiResponse.ok(
                analyticsService.generateReport(from, to, metrics)));
    }

    @GetMapping(value = "/admin/report/export.csv", produces = "text/csv")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Export MOH report as CSV")
    public ResponseEntity<byte[]> exportMohReportCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<String> metrics) {
        byte[] csv = analyticsService.exportReportCsv(from, to, metrics);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"moh-report-" + from + "-to-" + to + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping(value = "/admin/report/export.xlsx",
            produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Export MOH report as Excel (.xlsx)")
    public ResponseEntity<byte[]> exportMohReportExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<String> metrics) {
        byte[] xlsx = analyticsService.exportReportExcel(from, to, metrics);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"moh-report-" + from + "-to-" + to + ".xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(xlsx);
    }

    @GetMapping("/admin/scheduled-report")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get the current MOH scheduled report configuration")
    public ResponseEntity<ApiResponse<ScheduledReportConfigDto>> getScheduledConfig() {
        return ResponseEntity.ok(ApiResponse.ok(analyticsService.getScheduledConfig()));
    }

    @PutMapping("/admin/scheduled-report")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Save MOH scheduled report configuration")
    public ResponseEntity<ApiResponse<ScheduledReportConfigDto>> saveScheduledConfig(
            @RequestBody ScheduledReportConfigDto dto) {
        return ResponseEntity.ok(ApiResponse.ok(analyticsService.saveScheduledConfig(dto)));
    }

    // ── Provider endpoint ─────────────────────────────────────────────────────

    @GetMapping("/provider/me")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Provider's own performance analytics (PROVIDER only)")
    public ResponseEntity<ApiResponse<ProviderStatsDto>> providerStats() {
        return ResponseEntity.ok(ApiResponse.ok(
                analyticsService.providerStats(SecurityUtils.currentUserId())));
    }

    @GetMapping("/admin/consultations")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "All completed consultations across all providers in a date range (ADMIN only)")
    public ResponseEntity<ApiResponse<List<AdminConsultationRowDto>>> adminConsultationSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(ApiResponse.ok(
                analyticsService.adminConsultationSummary(from, to)));
    }

    @GetMapping("/provider/me/consultations")
    @PreAuthorize("hasRole('PROVIDER')")
    @Operation(summary = "Provider's patient consultation list, filterable by date range and status (PROVIDER only)")
    public ResponseEntity<ApiResponse<List<ConsultationSummaryDto>>> providerConsultationSummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "ALL") String filter) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                analyticsService.providerConsultationSummary(userId, from, to, filter)));
    }

    // ── Patient endpoint ──────────────────────────────────────────────────────

    @GetMapping("/patient/me")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Patient's own health summary (PATIENT only)")
    public ResponseEntity<ApiResponse<PatientHealthSummaryDto>> patientSummary() {
        return ResponseEntity.ok(ApiResponse.ok(
                analyticsService.patientHealthSummary(SecurityUtils.currentUserId())));
    }
}
