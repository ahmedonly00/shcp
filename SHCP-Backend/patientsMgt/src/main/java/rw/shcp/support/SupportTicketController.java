package rw.shcp.support;

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
import rw.shcp.support.dto.SubmitTicketRequest;
import rw.shcp.support.dto.TicketDto;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
@Tag(name = "Support", description = "Help and support ticket submission")
public class SupportTicketController {

    private final SupportTicketService supportTicketService;

    @PostMapping("/tickets")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Submit a support ticket")
    public ResponseEntity<ApiResponse<TicketDto>> submit(
            @Valid @RequestBody SubmitTicketRequest req) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.ok(supportTicketService.submit(
                        SecurityUtils.currentUserId(), req)));
    }
}
