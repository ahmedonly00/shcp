CREATE TABLE support_tickets (
    ticket_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         REFERENCES users(user_id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL,
    subject     VARCHAR(255) NOT NULL,
    message     TEXT         NOT NULL,
    priority    VARCHAR(10)  NOT NULL DEFAULT 'LOW'
                             CHECK (priority IN ('LOW', 'MEDIUM', 'URGENT')),
    status      VARCHAR(20)  NOT NULL DEFAULT 'OPEN'
                             CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
