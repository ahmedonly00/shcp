-- Conversations between a patient and a provider (one row per pair)
CREATE TABLE conversations (
    conversation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    starred_by_patient    BOOLEAN NOT NULL DEFAULT FALSE,
    starred_by_provider   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (patient_id, provider_id)
);

-- Individual messages within a conversation
CREATE TABLE messages (
    message_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    read            BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_conversations_patient  ON conversations(patient_id);
CREATE INDEX idx_conversations_provider ON conversations(provider_id);
CREATE INDEX idx_messages_conversation  ON messages(conversation_id);
CREATE INDEX idx_messages_sent_at       ON messages(conversation_id, sent_at DESC);
