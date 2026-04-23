package rw.shcp.users.dto;

import rw.shcp.ehr.HealthRecord;

import java.time.OffsetDateTime;
import java.util.UUID;

public record HealthRecordDto(
        UUID           recordId,
        UUID           patientId,
        String         diagnoses,
        String         medications,
        String         allergies,
        String         vitals,
        String         immunizations,
        String         labResults,
        String         documents,
        String         goals,
        String         activityLogs,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static HealthRecordDto from(HealthRecord r) {
        return new HealthRecordDto(
                r.getRecordId(),
                r.getPatient().getUserId(),
                r.getDiagnoses(),
                r.getMedications(),
                r.getAllergies(),
                r.getVitals(),
                r.getImmunizations(),
                r.getLabResults(),
                r.getDocuments(),
                r.getGoals()        != null ? r.getGoals()        : "[]",
                r.getActivityLogs() != null ? r.getActivityLogs() : "[]",
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }
}
