package rw.shcp.common;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import rw.shcp.common.enums.Role;
import rw.shcp.users.model.User;

import java.util.UUID;

/**
 * Helper to populate the {@link SecurityContextHolder} in tests that call
 * code relying on {@link rw.shcp.common.util.SecurityUtils}.
 */
public final class SecurityContextHelper {

    private SecurityContextHelper() {}

    public static User mockUser(UUID userId, Role role) {
        User user = new User();
        user.setUserId(userId);
        user.setName("Test User");
        user.setEmail("test@shcp.rw");
        user.setPhone("+250780000001");
        user.setRole(role);
        user.setVerified(true);

        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
        return user;
    }

    public static void clear() {
        SecurityContextHolder.clearContext();
    }
}
