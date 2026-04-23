package rw.shcp.consultations;

/** Constants for consultation audit event types. */
public final class AuditEventTypes {
    private AuditEventTypes() {}

    // Written by backend
    public static final String CALL_STARTED   = "CALL_STARTED";
    public static final String CALL_ENDED     = "CALL_ENDED";

    // Written by frontend (authenticated)
    public static final String JOINED                  = "JOINED";
    public static final String LEFT                    = "LEFT";
    public static final String ADMITTED                = "ADMITTED";
    public static final String RECORDING_STARTED       = "RECORDING_STARTED";
    public static final String RECORDING_STOPPED       = "RECORDING_STOPPED";
    public static final String RECORDING_CONSENT_GIVEN = "RECORDING_CONSENT_GIVEN";
    public static final String SCREEN_SHARE_STARTED    = "SCREEN_SHARE_STARTED";
    public static final String SCREEN_SHARE_STOPPED    = "SCREEN_SHARE_STOPPED";

    /** All event types that clients are allowed to submit. */
    public static final java.util.Set<String> CLIENT_ALLOWED = java.util.Set.of(
            JOINED, LEFT, ADMITTED,
            RECORDING_STARTED, RECORDING_STOPPED, RECORDING_CONSENT_GIVEN,
            SCREEN_SHARE_STARTED, SCREEN_SHARE_STOPPED
    );
}
