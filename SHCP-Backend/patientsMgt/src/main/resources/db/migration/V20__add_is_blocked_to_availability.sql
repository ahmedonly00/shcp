-- V20 — Add is_blocked column to availability table
-- Allows providers to manually block time slots without them being booked.

ALTER TABLE availability
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
