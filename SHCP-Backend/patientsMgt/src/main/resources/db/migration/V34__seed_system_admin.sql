-- V34 — Seed a verified system admin account
-- Credentials are provided separately; do not commit the plaintext password.

INSERT INTO users (
    name,
    email,
    phone,
    role,
    password_hash,
    is_verified,
    language_pref,
    failed_login_attempts,
    locked_until
)
VALUES (
    'System Admin',
    'sysadmin@shcp.rw',
    '+250700000001',
    'ADMIN',
    '$2b$12$WHfS9as76YXj3oITZhXamegmYskVqu4fmvuc.dq02AAJH/hjlY2Je',
    true,
    'en',
    0,
    NULL
)
ON CONFLICT (email) DO NOTHING;
