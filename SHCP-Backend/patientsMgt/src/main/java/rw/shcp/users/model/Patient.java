package rw.shcp.users.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.shcp.appointments.Appointment;
import rw.shcp.ehr.HealthRecord;
import rw.shcp.prescriptions.Prescription;
import rw.shcp.referrals.Referral;
import rw.shcp.symptoms.SymptomReport;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Patient profile — extends the base {@link User} via a shared primary key.
 * Full business logic lives in Phase 3; this entity exists so that
 * registration can insert the required FK row into the {@code patients} table.
 */
@Entity
@Table(name = "patients")
@Getter
@Setter
@NoArgsConstructor
public class Patient {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    // Nullable: Google OAuth patients are created without these fields.
    // Manual (email) registration validates them in the application layer.
    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "blood_type", length = 10)
    private String bloodType;

    @Column(name = "insurance_number", length = 50)
    private String insuranceNumber;

    @Column(name = "national_id", unique = true, length = 20)
    private String nationalId;

    @Column(name = "gender", length = 20)
    private String gender;

    @Column(name = "emergency_contact_name", length = 100)
    private String emergencyContactName;

    @Column(name = "emergency_contact_phone", length = 20)
    private String emergencyContactPhone;

    @Column(name = "insurance_provider", length = 100)
    private String insuranceProvider;

    @OneToOne(mappedBy = "patient", fetch = FetchType.LAZY)
    private HealthRecord healthRecord;

    @OneToMany(mappedBy = "patient", fetch = FetchType.LAZY)
    private List<Appointment> appointments = new ArrayList<>();

    @OneToMany(mappedBy = "patient", fetch = FetchType.LAZY)
    private List<Prescription> prescriptions = new ArrayList<>();

    @OneToMany(mappedBy = "patient", fetch = FetchType.LAZY)
    private List<Referral> referrals = new ArrayList<>();

    @OneToMany(mappedBy = "patient", fetch = FetchType.LAZY)
    private List<SymptomReport> symptomReports = new ArrayList<>();
}
