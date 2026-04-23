package rw.shcp.common.util;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import rw.shcp.common.exception.AppException;
import rw.shcp.users.model.User;

import java.util.UUID;

/**
 * Utility to extract the authenticated user from the Spring Security context.
 * All service methods that need "the current user" call {@link #currentUser()}.
 */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    /** Returns the authenticated {@link User}, or throws 401 if not present. */
    public static User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof User)) {
            throw AppException.unauthorized("Authentication required");
        }
        return (User) auth.getPrincipal();
    }

    /** Convenience: returns only the UUID of the current user. */
    public static UUID currentUserId() {
        return currentUser().getUserId();
    }
}
