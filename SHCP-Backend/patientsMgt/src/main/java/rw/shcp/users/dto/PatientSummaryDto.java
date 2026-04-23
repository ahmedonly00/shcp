package rw.shcp.users.dto;

import java.util.UUID;

import rw.shcp.users.model.Patient;

/** Lightweight patient card used in the provider's patient list. */
public record PatientSummaryDto(
        UUID   patientId,
        String name,
        String email,
        String phone,
        String nationalId
) {
    public static PatientSummaryDto from(Patient patient) {
        return new PatientSummaryDto(
                patient.getUserId(),
                patient.getUser().getName(),
                patient.getUser().getEmail(),
                patient.getUser().getPhone(),
                patient.getNationalId()
        );
    }
}
