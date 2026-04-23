package rw.shcp.common.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests the GlobalExceptionHandler response shapes using a dedicated
 * stub controller — no Spring context needed (standaloneSetup).
 */
class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new StubController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new ObjectMapper()))
                .build();
    }

    // ── AppException → correct HTTP status ────────────────────────────────────

    @Test
    void notFound_shouldReturn404WithErrorBody() throws Exception {
        mockMvc.perform(get("/stub/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void conflict_shouldReturn409() throws Exception {
        mockMvc.perform(get("/stub/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void badRequest_shouldReturn400() throws Exception {
        mockMvc.perform(get("/stub/bad-request"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void forbidden_shouldReturn403() throws Exception {
        mockMvc.perform(get("/stub/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ── Bean validation → 400 with field errors ───────────────────────────────

    @Test
    void validationError_shouldReturn400WithDetails() throws Exception {
        mockMvc.perform(post("/stub/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.error.details").isMap());
    }

    // ── Stub controller wired into this test only ─────────────────────────────

    @RestController
    @RequestMapping("/stub")
    static class StubController {

        @GetMapping("/not-found")
        void notFound() { throw AppException.notFound("item not found"); }

        @GetMapping("/conflict")
        void conflict() { throw AppException.conflict("already exists"); }

        @GetMapping("/bad-request")
        void badRequest() { throw AppException.badRequest("invalid value"); }

        @GetMapping("/forbidden")
        void forbidden() { throw AppException.forbidden("access denied"); }

        record Req(@jakarta.validation.constraints.NotBlank String name) {}

        @PostMapping("/validate")
        void validate(@RequestBody @jakarta.validation.Valid Req req) {}
    }
}
