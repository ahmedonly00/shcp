package rw.shcp.users.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Provider profile — full business logic in Phase 3.
 * Present here so registration can insert into the {@code providers} table.
 */
@Entity
@Table(name = "providers")
@Getter
@Setter
@NoArgsConstructor
public class Provider {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "license_number", unique = true, nullable = false, length = 50)
    private String licenseNumber;

    @Column(name = "specialty", nullable = false, length = 100)
    private String specialty;

    @Column(name = "facility", length = 150)
    private String facility;

    @Column(name = "rating", precision = 3, scale = 2)
    private BigDecimal rating = BigDecimal.ZERO;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "location", length = 100)
    private String location;

    @Column(name = "district", length = 60)
    private String district;
}
