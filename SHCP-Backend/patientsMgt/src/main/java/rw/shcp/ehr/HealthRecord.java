package rw.shcp.ehr;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.shcp.users.model.Patient;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "health_records")
@Getter @Setter @NoArgsConstructor
public class HealthRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "record_id", updatable = false, nullable = false)
    private UUID recordId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false, unique = true)
    private Patient patient;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "diagnoses", columnDefinition = "jsonb")
    private String diagnoses = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "medications", columnDefinition = "jsonb")
    private String medications = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "allergies", columnDefinition = "jsonb")
    private String allergies = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "vitals", columnDefinition = "jsonb")
    private String vitals = "{}";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "immunizations", columnDefinition = "jsonb")
    private String immunizations = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lab_results", columnDefinition = "jsonb")
    private String labResults = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "documents", columnDefinition = "jsonb")
    private String documents = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "goals", columnDefinition = "jsonb")
    private String goals = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "activity_logs", columnDefinition = "jsonb")
    private String activityLogs = "[]";

    @Column(name = "created_at", updatable = false, nullable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
