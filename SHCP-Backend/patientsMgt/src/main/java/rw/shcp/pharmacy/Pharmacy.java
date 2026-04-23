package rw.shcp.pharmacy;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "pharmacies")
@Getter
@Setter
@NoArgsConstructor
public class Pharmacy {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "pharmacy_id", updatable = false, nullable = false)
    private UUID pharmacyId;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "address", nullable = false, length = 300)
    private String address;

    // ── Rwanda administrative hierarchy (District → Sector → Cell) ──────────

    @Column(name = "district", length = 60)
    private String district;

    @Column(name = "sector", length = 80)
    private String sector;

    @Column(name = "cell", length = 80)
    private String cell;

    // ── GPS coordinates (WGS-84) ─────────────────────────────────────────────
    // Used as a tiebreaker when multiple pharmacies match at the same
    // administrative level: the one physically closest to the delivery address wins.

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    // ── Contact ──────────────────────────────────────────────────────────────

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "email", length = 150)
    private String email;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
