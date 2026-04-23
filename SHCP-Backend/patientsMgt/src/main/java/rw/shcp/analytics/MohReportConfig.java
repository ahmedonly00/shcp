package rw.shcp.analytics;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "moh_report_config")
@Getter @Setter @NoArgsConstructor
public class MohReportConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    /** JSON array of email strings, e.g. ["moh@gov.rw","stats@gov.rw"] */
    @Column(name = "recipient_emails", nullable = false, columnDefinition = "TEXT")
    private String recipientEmails = "[]";

    /** WEEKLY or MONTHLY */
    @Column(name = "schedule", nullable = false, length = 20)
    private String schedule = "WEEKLY";

    /** JSON array of metric keys, e.g. ["consultations","appointments"] */
    @Column(name = "metrics", nullable = false, columnDefinition = "TEXT")
    private String metrics = "[]";

    @Column(name = "enabled", nullable = false)
    private boolean enabled = false;

    @Column(name = "last_sent_at")
    private OffsetDateTime lastSentAt;

    @Column(name = "created_at", updatable = false, nullable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = OffsetDateTime.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = OffsetDateTime.now(); }
}
