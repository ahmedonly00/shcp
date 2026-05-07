package rw.shcp.symptoms;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "symptom_feedback")
@Getter @Setter @NoArgsConstructor
public class SymptomFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "report_id", nullable = false, unique = true)
    private SymptomReport report;

    /** true = AI matched doctor's finding, false = AI was wrong, null = not applicable */
    @Column(name = "was_correct")
    private Boolean wasCorrect;

    /** What the doctor actually diagnosed (free text, optional) */
    @Column(name = "doctor_diagnosis", length = 255)
    private String doctorDiagnosis;

    @Column(name = "submitted_at", updatable = false, nullable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime submittedAt;

    @PrePersist
    void onCreate() {
        submittedAt = OffsetDateTime.now();
    }
}
