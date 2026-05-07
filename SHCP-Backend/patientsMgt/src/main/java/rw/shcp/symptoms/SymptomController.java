package rw.shcp.symptoms;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.symptoms.dto.FeedbackInput;
import rw.shcp.symptoms.dto.SymptomInput;
import rw.shcp.symptoms.dto.SymptomReportDto;

import java.util.UUID;

@RestController
@RequestMapping("/api/symptoms")
@RequiredArgsConstructor
@Tag(name = "Symptoms", description = "AI-powered symptom analysis and report history")
public class SymptomController {

    private final SymptomService symptomService;

    @PostMapping("/analyze")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(
        summary  = "Submit symptoms for AI analysis",
        description = "Sends symptom data to the Flask AI microservice. " +
                      "Returns a degraded response if the AI service is unavailable — " +
                      "the API never fails because of AI downtime."
    )
    public ResponseEntity<ApiResponse<SymptomReportDto>> analyze(
            @Valid @RequestBody SymptomInput input) {
        UUID patientId = SecurityUtils.currentUserId();
        SymptomReportDto result = symptomService.analyze(patientId, input);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(result));
    }

    @GetMapping("/reports/{reportId}")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(summary = "Get a specific symptom report (own reports only)")
    public ResponseEntity<ApiResponse<SymptomReportDto>> getReport(
            @PathVariable UUID reportId) {
        UUID patientId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(ApiResponse.ok(
                symptomService.getReport(reportId, patientId)));
    }

    @PostMapping("/reports/{reportId}/feedback")
    @PreAuthorize("hasRole('PATIENT')")
    @Operation(
        summary = "Submit feedback on a screening result",
        description = "Records whether the AI screening matched the doctor's diagnosis. " +
                      "Submitting again overwrites the previous feedback for the same report."
    )
    public ResponseEntity<ApiResponse<Void>> submitFeedback(
            @PathVariable UUID reportId,
            @Valid @RequestBody FeedbackInput input) {
        UUID patientId = SecurityUtils.currentUserId();
        symptomService.submitFeedback(reportId, patientId, input);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
