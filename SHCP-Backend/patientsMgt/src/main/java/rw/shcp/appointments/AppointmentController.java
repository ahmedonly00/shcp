package rw.shcp.appointments;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import rw.shcp.appointments.dto.*;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.users.model.User;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/appointments")
@RequiredArgsConstructor
@Tag(name = "Appointments", description = "Book, view, cancel and reschedule appointments")
public class AppointmentController {

        private final AppointmentService appointmentService;

        @PostMapping
        @Operation(summary = "Book a new appointment (PATIENT only)")
        public ResponseEntity<ApiResponse<AppointmentDto>> book(
                        @Valid @RequestBody BookingRequest req) {
                UUID userId = SecurityUtils.currentUserId();
                return ResponseEntity.status(HttpStatus.CREATED)
                                .body(ApiResponse.ok(appointmentService.book(userId, req)));
        }

        @GetMapping("/{id}")
        @Operation(summary = "Get appointment by ID (must be own appointment)")
        public ResponseEntity<ApiResponse<AppointmentDto>> getById(
                        @PathVariable UUID id) {
                User user = SecurityUtils.currentUser();
                return ResponseEntity.ok(ApiResponse.ok(
                                appointmentService.getById(id, user.getUserId(), user.getRole())));
        }

        @PutMapping("/{id}/cancel")
        @Operation(summary = "Cancel an appointment with a reason")
        public ResponseEntity<ApiResponse<AppointmentDto>> cancel(
                        @PathVariable UUID id,
                        @Valid @RequestBody CancelRequest req) {
                User user = SecurityUtils.currentUser();
                return ResponseEntity.ok(ApiResponse.ok(
                                appointmentService.cancel(id, user.getUserId(), user.getRole(), req)));
        }

        @PutMapping("/{id}/reschedule")
        @Operation(summary = "Reschedule an appointment to a new time or slot")
        public ResponseEntity<ApiResponse<AppointmentDto>> reschedule(
                        @PathVariable UUID id,
                        @Valid @RequestBody RescheduleRequest req) {
                User user = SecurityUtils.currentUser();
                return ResponseEntity.ok(ApiResponse.ok(
                                appointmentService.reschedule(id, user.getUserId(), user.getRole(), req)));
        }

        @GetMapping("/available")
        @Operation(summary = "Search available appointment slots", description = "Filters: ?specialty=&date=YYYY-MM-DD&language=&type=VIDEO|FOLLOWUP|URGENT")
        public ResponseEntity<ApiResponse<List<AvailableSlotDto>>> searchAvailable(
                        @RequestParam(required = false) String specialty,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                        @RequestParam(required = false) String language,
                        @RequestParam(required = false) String type) {
                return ResponseEntity.ok(ApiResponse.ok(
                                appointmentService.searchAvailable(specialty, date, language, type)));
        }
}
