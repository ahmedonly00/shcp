package rw.shcp.prescriptions;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import rw.shcp.common.enums.PrescriptionStatus;
import rw.shcp.consultations.Consultation;
import rw.shcp.pharmacy.Pharmacist;
import rw.shcp.pharmacy.Pharmacy;
import rw.shcp.users.model.Patient;
import rw.shcp.users.model.Provider;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "prescriptions")
@Getter
@Setter
@NoArgsConstructor
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "prescription_id", updatable = false, nullable = false)
    private UUID prescriptionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "consultation_id")
    private Consultation consultation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private Provider provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pharmacy_id")
    private Pharmacy pharmacy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dispensed_by")
    private Pharmacist dispensedBy;

    @Column(name = "delivery_address", length = 300)
    private String deliveryAddress;

    /** Rwanda administrative hierarchy used for nearest-pharmacy matching. */
    @Column(name = "delivery_district", length = 60)
    private String deliveryDistrict;

    @Column(name = "delivery_sector", length = 80)
    private String deliverySector;

    @Column(name = "delivery_cell", length = 80)
    private String deliveryCell;

    /** WGS-84 GPS coordinates of the delivery point — enables Haversine tiebreaking. */
    @Column(name = "delivery_latitude")
    private Double deliveryLatitude;

    @Column(name = "delivery_longitude")
    private Double deliveryLongitude;

    /**
     * JSON array of MedicationItem objects stored in PostgreSQL JSONB.
     * Example: [{"name":"Amoxicillin","dosage":"500mg","frequency":"3x/day","durationDays":7}]
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "medications", columnDefinition = "jsonb", nullable = false)
    private String medications = "[]";

    @Column(name = "instructions", columnDefinition = "TEXT")
    private String instructions;

    /** Provider's digital signature (full name) captured at time of issue. */
    @Column(name = "provider_signature", length = 500)
    private String providerSignature;

    @Column(name = "issued_at", nullable = false, updatable = false, columnDefinition = "TIMESTAMPTZ DEFAULT NOW()")
    private OffsetDateTime issuedAt;

    @Column(name = "valid_until")
    private LocalDate validUntil;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 25)
    private PrescriptionStatus status = PrescriptionStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onPersist() {
        issuedAt = OffsetDateTime.now();
    }
}
