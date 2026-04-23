-- V17 — Add notes column to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT;
