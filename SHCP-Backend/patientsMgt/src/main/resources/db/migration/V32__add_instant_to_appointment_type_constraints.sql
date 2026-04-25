-- V32 — Add INSTANT to appointment type CHECK constraints
-- The INSTANT type was added to the Java AppointmentType enum (and used by startInstant()),
-- but V31 never updated the DB constraints, causing a constraint violation at runtime.

-- Fix appointments.type constraint
ALTER TABLE appointments
    DROP CONSTRAINT IF EXISTS appointments_type_check;

ALTER TABLE appointments
    ADD CONSTRAINT appointments_type_check
    CHECK (type IN ('VIDEO', 'FOLLOWUP', 'URGENT', 'INSTANT'));

-- Fix availability.appointment_type constraint
ALTER TABLE availability
    DROP CONSTRAINT IF EXISTS availability_appointment_type_check;

ALTER TABLE availability
    ADD CONSTRAINT availability_appointment_type_check
    CHECK (appointment_type IN ('VIDEO', 'FOLLOWUP', 'URGENT', 'INSTANT'));
