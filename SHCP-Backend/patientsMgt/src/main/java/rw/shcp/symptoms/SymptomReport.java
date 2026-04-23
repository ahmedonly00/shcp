package rw.shcp.symptoms;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.shcp.users.model.Patient;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "symptom_reports")
@Getter @Setter @NoArgsConstructor
public class SymptomReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "report_id", updatable = false, nullable = false)
    private UUID reportId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "symptoms", nullable = false, columnDefinition = "jsonb")
    private String symptoms = "[]";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "body_map_data", columnDefinition = "jsonb")
    private String bodyMapData;

    @Column(name = "symptom_text", columnDefinition = "TEXT")
    private String symptomText;

    @Column(name = "language", nullable = false, length = 5)
    private String language = "rw";

    @Column(name = "ai_urgency", length = 20)
    private String aiUrgency;

    @Column(name = "ai_pathway", length = 50)
    private String aiPathway;

    @Column(name = "ai_confidence", precision = 5, scale = 2)
    private BigDecimal aiConfidence;

    @Column(name = "care_recommendation", columnDefinition = "TEXT")
    private String careRecommendation;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_raw_response", columnDefinition = "jsonb")
    private String aiRawResponse;

    @Column(name = "created_at", updatable = false, nullable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = OffsetDateTime.now();
    }
}
