package rw.shcp.pharmacy;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "pharmacy_inventory",
       uniqueConstraints = @UniqueConstraint(
               name = "uq_pharmacy_medication",
               columnNames = {"pharmacy_id", "medication_name"}))
@Getter
@Setter
@NoArgsConstructor
public class PharmacyInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "inventory_id", updatable = false, nullable = false)
    private UUID inventoryId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pharmacy_id", nullable = false)
    private Pharmacy pharmacy;

    /** Primary medication name exactly as prescribed (e.g. "Amoxicillin 500mg"). */
    @Column(name = "medication_name", nullable = false, length = 200)
    private String medicationName;

    /** Generic / INN name for fuzzy matching (e.g. "amoxicillin"). */
    @Column(name = "generic_name", length = 200)
    private String genericName;

    @Column(name = "quantity_in_stock", nullable = false)
    private int quantityInStock = 0;

    /** Unit of measure: "units", "tablets", "vials", "bottles", etc. */
    @Column(name = "unit", nullable = false, length = 50)
    private String unit = "units";

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    /** Stock level at which a reorder alert should be triggered. */
    @Column(name = "reorder_level", nullable = false)
    private int reorderLevel = 10;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onPersist() {
        createdAt = OffsetDateTime.now();
        updatedAt  = createdAt;
    }
}
