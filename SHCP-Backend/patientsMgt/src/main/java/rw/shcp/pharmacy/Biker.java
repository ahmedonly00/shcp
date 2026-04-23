package rw.shcp.pharmacy;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import rw.shcp.common.enums.BikerStatus;
import rw.shcp.users.model.User;

import java.util.UUID;

@Entity
@Table(name = "bikers")
@Getter
@Setter
@NoArgsConstructor
public class Biker {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pharmacy_id", nullable = false)
    private Pharmacy pharmacy;

    @Column(name = "license_number", length = 50)
    private String licenseNumber;

    @Column(name = "vehicle_type", length = 50)
    private String vehicleType;

    @Column(name = "operating_zone", length = 100)
    private String operatingZone;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private BikerStatus status = BikerStatus.OFFLINE;
}
