package rw.shcp.users.dto;

import rw.shcp.users.model.Patient;

import java.time.LocalDate;
import java.util.UUID;

/** Full patient snapshot used to generate a check-up report. */
public record PatientCheckUpSummaryDto(
        UUID      patientId,
        String    name,
        String    email,
        String    phone,
        LocalDate dateOfBirth,
        String    gender,
        String    bloodType,
        String    nationalId,
        String    insuranceProvider,
        String    insuranceNumber,
        String    emergencyContactName,
        String    emergencyContactPhone
) {
    public static PatientCheckUpSummaryDto from(Patient patient) {
        return new PatientCheckUpSummaryDto(
                patient.getUserId(),
                patient.getUser().getName(),
                patient.getUser().getEmail(),
                patient.getUser().getPhone(),
                patient.getDateOfBirth(),
                patient.getGender(),
                patient.getBloodType(),
                patient.getNationalId(),
                patient.getInsuranceProvider(),
                patient.getInsuranceNumber(),
                patient.getEmergencyContactName(),
                patient.getEmergencyContactPhone()
        );
    }
}
