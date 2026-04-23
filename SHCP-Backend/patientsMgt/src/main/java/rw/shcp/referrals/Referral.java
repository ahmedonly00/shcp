package rw.shcp.referrals;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.shcp.consultations.Consultation;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "referrals")
@Getter @Setter @NoArgsConstructor
public class Referral {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "referral_id", updatable = false, nullable = false)
    private UUID referralId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referring_provider_id", nullable = false)
    private Provider referringProvider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialist_id")
    private Provider specialist;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "consultation_id")
    private Consultation consultation;

    @Column(name = "specialty_needed", nullable = false, length = 100)
    private String specialtyNeeded;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "urgency", nullable = false, length = 20)
    private String urgency = "ROUTINE";  // EMERGENCY, URGENT, ROUTINE

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";   // PENDING, ACCEPTED, COMPLETED, REJECTED

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // ── External-institution referral fields (null for INTERNAL referrals) ──

    @Column(name = "referral_type", nullable = false, length = 20)
    private String referralType = "INTERNAL";  // INTERNAL | EXTERNAL

    @Column(name = "institution_name", length = 200)
    private String institutionName;

    @Column(name = "institution_type", length = 50)
    private String institutionType;  // HOSPITAL | SURGICAL_CENTER | CLINIC | LABORATORY | IMAGING_CENTER | REHABILITATION_CENTER

    @Column(name = "institution_address", columnDefinition = "TEXT")
    private String institutionAddress;

    @Column(name = "institution_contact", length = 100)
    private String institutionContact;

    @Column(name = "treatment_type", length = 50)
    private String treatmentType;  // OPERATION | SPECIALIST_CARE | EMERGENCY | LAB_TESTS | IMAGING | PHYSIOTHERAPY | REHABILITATION | OTHER

    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = OffsetDateTime.now(); }
    @PreUpdate  void onUpdate() { updatedAt = OffsetDateTime.now(); }
}
