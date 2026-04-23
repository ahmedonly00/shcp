package rw.shcp.common.config;

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

/**
 * Runs once on startup to seed the default admin account.
 * Skipped if an ADMIN user already exists.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements ApplicationRunner {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.findByEmail("admin@shcp.rw").isPresent()) {
            return; // already seeded
        }

        User admin = new User();
        admin.setName("System Administrator");
        admin.setEmail("admin@shcp.rw");
        admin.setPhone("+250780000000");
        admin.setRole(Role.ADMIN);
        admin.setPasswordHash(passwordEncoder.encode("Admin@2024!"));
        admin.setVerified(true);
        admin.setLanguagePref("en");

        userRepository.save(admin);
        log.info("Seeded default admin: admin@shcp.rw / Admin@2024!");
    }
}
