package rw.shcp.common.enums;

public enum DeliveryStatus {
    /** Pharmacist has assigned a biker, awaiting acceptance. */
    ASSIGNED,
    /** Biker accepted the order. */
    ACCEPTED,
    /** Biker collected the package from the pharmacy. */
    PICKED_UP,
    /** Biker is in transit. */
    ON_THE_WAY,
    /** Successfully delivered. */
    DELIVERED,
    /** Biker declined the assignment. */
    DECLINED,
    /** Delivery attempt failed. */
    FAILED
}
