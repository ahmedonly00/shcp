package rw.shcp.consultations;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import rw.shcp.appointments.Appointment;
import rw.shcp.common.enums.ConsultationStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "consultations")
@Getter
@Setter
@NoArgsConstructor
public class Consultation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "consultation_id", updatable = false, nullable = false)
    private UUID consultationId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id", nullable = false, unique = true)
    private Appointment appointment;

    /** Unique room token used by the signaling server. */
    @Column(name = "room_id", unique = true, length = 100)
    private String roomId;

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    /** Provider's clinical notes entered after the call. */
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ConsultationStatus status = ConsultationStatus.SCHEDULED;

    @Column(name = "recording_url", columnDefinition = "TEXT")
    private String recordingUrl;

    /** Timestamp when the patient explicitly consented to recording. Null = no consent given yet. */
    @Column(name = "recording_consent_at")
    private OffsetDateTime recordingConsentAt;

    /** userId of the patient who granted recording consent. */
    @Column(name = "recording_consent_by_id")
    private UUID recordingConsentById;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
