package rw.shcp.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${admin.initial-email:admin@shcp.rw}")
    private String adminEmail;

    @Value("${admin.initial-password:Admin@1234}")
    private String adminPassword;

    @Value("${admin.initial-name:SHCP Administrator}")
    private String adminName;

    @Value("${admin.initial-phone:+250780000000}")
    private String adminPhone;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.existsByEmail(adminEmail)) {
            log.debug("Admin user already exists — skipping seed");
            return;
        }

        User admin = new User();
        admin.setName(adminName);
        admin.setEmail(adminEmail);
        admin.setPhone(adminPhone);
        admin.setRole(Role.ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setLanguagePref("en");
        admin.setVerified(true);  // admin is pre-verified

        userRepository.save(admin);
        log.info("Admin user seeded: {}", adminEmail);
    }
}
