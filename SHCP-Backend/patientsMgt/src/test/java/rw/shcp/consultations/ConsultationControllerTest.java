package rw.shcp.consultations;

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
import rw.shcp.common.SecurityContextHelper;
import rw.shcp.common.TestSecurityConfig;
import rw.shcp.common.enums.Role;
import rw.shcp.common.exception.AppException;
import rw.shcp.consultations.dto.ConsultationDto;
import rw.shcp.consultations.dto.EndConsultationRequest;
import rw.shcp.consultations.dto.StartConsultationRequest;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ConsultationController.class)
@Import(TestSecurityConfig.class)
class ConsultationControllerTest {

    @Autowired MockMvc      mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean ConsultationService consultationService;

    private UUID providerId;
    private UUID patientId;

    @BeforeEach
    void setUp() {
        providerId = UUID.randomUUID();
        patientId  = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHelper.clear();
    }

    // ── POST /api/consultations ───────────────────────────────────────────────

    @Test
    void start_shouldReturn201_andRoomId() throws Exception {
        SecurityContextHelper.mockUser(providerId, Role.PROVIDER);
        UUID appointmentId = UUID.randomUUID();
        ConsultationDto dto = buildDto("IN_PROGRESS");
        when(consultationService.start(eq(providerId), any(StartConsultationRequest.class)))
                .thenReturn(dto);

        mockMvc.perform(post("/api/consultations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new StartConsultationRequest(appointmentId))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.data.roomId").isNotEmpty());
    }

    @Test
    void start_shouldReturn400_whenAppointmentNotConfirmed() throws Exception {
        SecurityContextHelper.mockUser(providerId, Role.PROVIDER);
        when(consultationService.start(any(), any()))
                .thenThrow(AppException.badRequest("Only CONFIRMED appointments can be started"));

        mockMvc.perform(post("/api/consultations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new StartConsultationRequest(UUID.randomUUID()))))
                .andExpect(status().isBadRequest());
    }

    // ── PUT /api/consultations/{id}/end ──────────────────────────────────────

    @Test
    void end_shouldReturn200_withCompletedStatus() throws Exception {
        SecurityContextHelper.mockUser(providerId, Role.PROVIDER);
        UUID consultationId = UUID.randomUUID();
        ConsultationDto dto = buildDto("COMPLETED");
        when(consultationService.end(eq(consultationId), eq(providerId),
                any(EndConsultationRequest.class))).thenReturn(dto);

        mockMvc.perform(put("/api/consultations/" + consultationId + "/end")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            { "notes": "Patient recovering well" }
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }

    // ── GET /api/consultations/{id} ───────────────────────────────────────────

    @Test
    void getById_shouldReturn200_forPatient() throws Exception {
        SecurityContextHelper.mockUser(patientId, Role.PATIENT);
        UUID consultationId = UUID.randomUUID();
        ConsultationDto dto = buildDto("COMPLETED");
        when(consultationService.getById(eq(consultationId), eq(patientId), eq(Role.PATIENT)))
                .thenReturn(dto);

        mockMvc.perform(get("/api/consultations/" + consultationId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.roomId").isNotEmpty());
    }

    // ── GET /api/consultations/me ─────────────────────────────────────────────

    @Test
    void getMine_shouldReturn200_withList() throws Exception {
        SecurityContextHelper.mockUser(patientId, Role.PATIENT);
        when(consultationService.getMyConsultations(eq(patientId), eq(Role.PATIENT)))
                .thenReturn(List.of(buildDto("COMPLETED")));

        mockMvc.perform(get("/api/consultations/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1));
    }

    // ── fixture ───────────────────────────────────────────────────────────────

    private ConsultationDto buildDto(String status) {
        return new ConsultationDto(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID().toString(), status,
                OffsetDateTime.now().minusMinutes(30), OffsetDateTime.now(),
                30, "Some notes", null, OffsetDateTime.now(), null, OffsetDateTime.now()
        );
    }
}
