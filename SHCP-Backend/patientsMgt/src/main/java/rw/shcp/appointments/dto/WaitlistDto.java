package rw.shcp.appointments.dto;

import rw.shcp.appointments.Waitlist;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record WaitlistDto(
        UUID        entryId,
        UUID        patientId,
        String      patientName,
        UUID        providerId,
        String      providerName,
        String      providerSpecialty,
        LocalDate   date,
        String      type,
        boolean     notified,
        int         position,
        OffsetDateTime createdAt
) {
    public static WaitlistDto from(Waitlist w, int position) {
        return new WaitlistDto(
                w.getEntryId(),
                w.getPatient().getUserId(),
                w.getPatient().getUser().getName(),
                w.getProvider().getUserId(),
                w.getProvider().getUser().getName(),
                w.getProvider().getSpecialty(),
                w.getDate(),
                w.getType(),
                w.isNotified(),
                position,
                w.getCreatedAt()
        );
    }
}
