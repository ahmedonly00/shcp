-- V29 — Real-time biker GPS tracking on deliveries
-- Bikers POST their GPS coordinates while en route; patients poll these columns
-- to see where their medication is at any point during delivery.
ALTER TABLE deliveries
    ADD COLUMN biker_latitude      DOUBLE PRECISION,
    ADD COLUMN biker_longitude     DOUBLE PRECISION,
    ADD COLUMN location_updated_at TIMESTAMPTZ;
