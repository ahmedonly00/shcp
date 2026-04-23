package rw.shcp.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import rw.shcp.common.enums.Role;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.UserRepository;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminDataInitializer implements ApplicationRunner {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    /** Default admin credentials — change via env vars in production */
    private static final String ADMIN_EMAIL    = System.getenv().getOrDefault("ADMIN_EMAIL",    "admin@shcp.rw");
    private static final String ADMIN_PASSWORD = System.getenv().getOrDefault("ADMIN_PASSWORD", "Admin@1234");
    private static final String ADMIN_NAME     = System.getenv().getOrDefault("ADMIN_NAME",     "SHCP Administrator");
    private static final String ADMIN_PHONE    = System.getenv().getOrDefault("ADMIN_PHONE",    "+250780000000");

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.existsByEmail(ADMIN_EMAIL)) {
            log.debug("Admin user already exists — skipping seed");
            return;
        }

        User admin = new User();
        admin.setName(ADMIN_NAME);
        admin.setEmail(ADMIN_EMAIL);
        admin.setPhone(ADMIN_PHONE);
        admin.setRole(Role.ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(ADMIN_PASSWORD));
        admin.setLanguagePref("en");
        admin.setVerified(true);  // admin is pre-verified

        userRepository.save(admin);
        log.info("Admin user seeded: {}", ADMIN_EMAIL);
    }
}
