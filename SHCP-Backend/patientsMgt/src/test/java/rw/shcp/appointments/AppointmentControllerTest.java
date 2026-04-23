package rw.shcp.appointments;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import rw.shcp.appointments.dto.*;
import rw.shcp.common.TestSecurityConfig;
import rw.shcp.common.SecurityContextHelper;
import rw.shcp.common.enums.*;
import rw.shcp.common.exception.AppException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AppointmentController.class)
@Import(TestSecurityConfig.class)
class AppointmentControllerTest {

    @Autowired MockMvc      mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean AppointmentService appointmentService;

    private UUID patientId;

    @BeforeEach
    void setUp() {
        patientId = UUID.randomUUID();
        SecurityContextHelper.mockUser(patientId, Role.PATIENT);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHelper.clear();
    }

    // ── POST /api/appointments ────────────────────────────────────────────────

    @Test
    void book_shouldReturn201_onSuccess() throws Exception {
        AppointmentDto dto = buildAppointmentDto(patientId);
        when(appointmentService.book(any(), any(BookingRequest.class))).thenReturn(dto);

        mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new BookingRequest(UUID.randomUUID(), null,
                                        OffsetDateTime.now().plusDays(1), AppointmentType.VIDEO, null, null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }

    @Test
    void book_shouldReturn409_onDoubleBooking() throws Exception {
        when(appointmentService.book(any(), any(BookingRequest.class)))
                .thenThrow(AppException.conflict("Slot already booked"));

        mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new BookingRequest(UUID.randomUUID(), null,
                                        OffsetDateTime.now().plusDays(1), AppointmentType.VIDEO, null, null))))
                .andExpect(status().isConflict());
    }

    // ── GET /api/appointments/{id} ────────────────────────────────────────────

    @Test
    void getById_shouldReturn200_forOwner() throws Exception {
        UUID appointmentId = UUID.randomUUID();
        AppointmentDto dto = buildAppointmentDto(patientId);
        when(appointmentService.getById(eq(appointmentId), any(), any())).thenReturn(dto);

        mockMvc.perform(get("/api/appointments/" + appointmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.patientId").value(patientId.toString()));
    }

    @Test
    void getById_shouldReturn403_forNonOwner() throws Exception {
        UUID appointmentId = UUID.randomUUID();
        when(appointmentService.getById(eq(appointmentId), any(), any()))
                .thenThrow(AppException.forbidden("Not your appointment"));

        mockMvc.perform(get("/api/appointments/" + appointmentId))
                .andExpect(status().isForbidden());
    }

    // ── PUT /api/appointments/{id}/cancel ─────────────────────────────────────

    @Test
    void cancel_shouldReturn200_andUpdatedStatus() throws Exception {
        UUID appointmentId = UUID.randomUUID();
        AppointmentDto cancelled = buildAppointmentDtoWithStatus(patientId, AppointmentStatus.CANCELLED);
        when(appointmentService.cancel(eq(appointmentId), any(), any(), any(CancelRequest.class)))
                .thenReturn(cancelled);

        mockMvc.perform(put("/api/appointments/" + appointmentId + "/cancel")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "reason": "Schedule conflict" }
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    // ── GET /api/appointments/available ──────────────────────────────────────

    @Test
    void searchAvailable_shouldReturn200_withSlots() throws Exception {
        when(appointmentService.searchAvailable(any(), any(), any(), any())).thenReturn(List.of(
                new AvailableSlotDto(UUID.randomUUID(), UUID.randomUUID(), "Dr Test",
                        "General Medicine", "Kigali Health Center", BigDecimal.valueOf(4.5),
                        OffsetDateTime.now().plusDays(1),
                        OffsetDateTime.now().plusDays(1).plusMinutes(30), "VIDEO")
        ));

        mockMvc.perform(get("/api/appointments/available"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    // ── fixture ───────────────────────────────────────────────────────────────

    private AppointmentDto buildAppointmentDto(UUID patientId) {
        return buildAppointmentDtoWithStatus(patientId, AppointmentStatus.CONFIRMED);
    }

    private AppointmentDto buildAppointmentDtoWithStatus(UUID patientId, AppointmentStatus status) {
        return new AppointmentDto(
                UUID.randomUUID(), patientId, "Alice Patient",
                UUID.randomUUID(), "Dr. Provider", "General Medicine",
                null, OffsetDateTime.now().plusDays(1),
                "VIDEO", status.name(),
                null, null, null, null, OffsetDateTime.now()
        );
    }
}
