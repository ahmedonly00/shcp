-- OTP tokens (email verification and password reset)
CREATE TABLE otp_tokens (
    id         BIGSERIAL    PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    type       VARCHAR(10)  NOT NULL,   -- VERIFY | RESET
    code       VARCHAR(6)   NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL
);

CREATE UNIQUE INDEX uq_otp_tokens_email_type ON otp_tokens (email, type);

-- Refresh token whitelist (replaces Redis)
CREATE TABLE refresh_tokens (
    jti        VARCHAR(36)  PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
