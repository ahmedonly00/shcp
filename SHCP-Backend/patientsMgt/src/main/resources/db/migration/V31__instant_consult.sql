-- V31 — Instant consultation support
-- Adds provider availability flag for on-demand calls

ALTER TABLE providers
    ADD COLUMN is_available_for_instant BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_providers_instant ON providers(is_available_for_instant) WHERE is_available_for_instant = true;
