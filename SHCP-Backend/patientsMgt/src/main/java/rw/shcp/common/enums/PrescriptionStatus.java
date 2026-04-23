package rw.shcp.common.enums;

public enum PrescriptionStatus {
    /** Issued by provider, awaiting pharmacy assignment. */
    PENDING,
    /** Pharmacist is preparing the medication. */
    PROCESSING,
    /** Medication is packaged, awaiting biker pickup. */
    READY_FOR_DELIVERY,
    /** Biker has collected the package from the pharmacy. */
    PICKED_UP,
    /** Biker is in transit to the patient. */
    ON_THE_WAY,
    /** Successfully delivered to the patient. */
    DELIVERED,
    /** Delivery attempt failed (patient unreachable, etc.). */
    FAILED,
    /** Prescription cancelled by the provider. */
    CANCELLED,
    /** Prescription has passed its valid-until date. */
    EXPIRED
}
