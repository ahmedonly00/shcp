-- V36 — Add registered_at to bikers table
-- BikerRepository.findAvailableSortedByZone ordered by b.created_at which never existed.
-- Renamed to registered_at to avoid confusion with Hibernate @CreationTimestamp conventions.
ALTER TABLE bikers
    ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ NOT NULL DEFAULT now();
