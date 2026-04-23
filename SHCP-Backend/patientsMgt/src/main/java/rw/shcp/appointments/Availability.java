package rw.shcp.appointments;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.shcp.common.enums.AppointmentType;
import rw.shcp.users.model.Provider;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "availability")
@Getter
@Setter
@NoArgsConstructor
public class Availability {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "slot_id", updatable = false, nullable = false)
    private UUID slotId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private Provider provider;

    @Column(name = "start_time", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime startTime;

    @Column(name = "end_time", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime endTime;

    @Column(name = "is_booked", nullable = false)
    private boolean isBooked = false;

    @Column(name = "is_blocked", nullable = false)
    private boolean isBlocked = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "appointment_type", length = 20)
    private AppointmentType appointmentType;
}
