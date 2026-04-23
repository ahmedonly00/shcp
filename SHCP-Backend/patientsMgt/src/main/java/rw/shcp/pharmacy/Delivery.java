package rw.shcp.pharmacy;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import rw.shcp.common.enums.DeliveryStatus;
import rw.shcp.prescriptions.Prescription;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "deliveries")
@Getter
@Setter
@NoArgsConstructor
public class Delivery {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "delivery_id", updatable = false, nullable = false)
    private UUID deliveryId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prescription_id", nullable = false, unique = true)
    private Prescription prescription;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "biker_id")
    private Biker biker;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private DeliveryStatus status = DeliveryStatus.ASSIGNED;

    @Column(name = "assigned_at")
    private OffsetDateTime assignedAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "picked_up_at")
    private OffsetDateTime pickedUpAt;

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @Column(name = "confirmation_photo_url", length = 500)
    private String confirmationPhotoUrl;

    @Column(name = "failure_reason", length = 300)
    private String failureReason;

    // ── Real-time biker location ───────────────────────────────────────────────
    // Bikers PATCH their GPS coordinates while en route; patients poll to track.

    @Column(name = "biker_latitude")
    private Double bikerLatitude;

    @Column(name = "biker_longitude")
    private Double bikerLongitude;

    @Column(name = "location_updated_at")
    private OffsetDateTime locationUpdatedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
