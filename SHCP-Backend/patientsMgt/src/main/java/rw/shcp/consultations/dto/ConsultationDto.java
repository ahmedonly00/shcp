package rw.shcp.consultations.dto;

import rw.shcp.consultations.Consultation;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ConsultationDto(
        UUID   consultationId,
        UUID   appointmentId,
        String roomId,
        String status,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt,
        Integer durationMinutes,
        String  notes,
        String  recordingUrl,
        OffsetDateTime recordingConsentAt,
        UUID   recordingConsentById,
        OffsetDateTime createdAt
) {
    public static ConsultationDto from(Consultation c) {
        return new ConsultationDto(
                c.getConsultationId(),
                c.getAppointment().getAppointmentId(),
                c.getRoomId(),
                c.getStatus().name(),
                c.getStartedAt(),
                c.getEndedAt(),
                c.getDurationMinutes(),
                c.getNotes(),
                c.getRecordingUrl(),
                c.getRecordingConsentAt(),
                c.getRecordingConsentById(),
                c.getCreatedAt()
        );
    }
}
