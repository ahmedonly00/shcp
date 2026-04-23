package rw.shcp.appointments;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "waitlist_entries",
       uniqueConstraints = @UniqueConstraint(columnNames = {"patient_id", "provider_id", "date"}))
@Getter @Setter @NoArgsConstructor
public class Waitlist {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "entry_id", updatable = false, nullable = false)
    private UUID entryId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private Provider provider;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "type", nullable = false, length = 20)
    private String type = "VIDEO";

    @Column(name = "notified", nullable = false)
    private boolean notified = false;

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @PrePersist void onCreate() { createdAt = OffsetDateTime.now(); }
}
