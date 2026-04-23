package rw.shcp.users.dto;

import rw.shcp.users.model.Patient;
import rw.shcp.users.model.User;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PatientProfileDto(
        UUID userId,
        String name,
        String email,
        String phone,
        String role,
        String languagePref,
        boolean isVerified,
        LocalDate dateOfBirth,
        String bloodType,
        String insuranceNumber,
        String nationalId,
        String gender,
        String emergencyContactName,
        String emergencyContactPhone,
        String insuranceProvider,
        String profilePictureUrl,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static PatientProfileDto from(Patient patient) {
        User u = patient.getUser();
        return new PatientProfileDto(
                u.getUserId(),
                u.getName(),
                u.getEmail(),
                u.getPhone(),
                u.getRole().name(),
                u.getLanguagePref(),
                u.isVerified(),
                patient.getDateOfBirth(),
                patient.getBloodType(),
                patient.getInsuranceNumber(),
                patient.getNationalId(),
                patient.getGender(),
                patient.getEmergencyContactName(),
                patient.getEmergencyContactPhone(),
                patient.getInsuranceProvider(),
                u.getProfilePictureUrl(),
                u.getCreatedAt(),
                u.getUpdatedAt());
    }
}
