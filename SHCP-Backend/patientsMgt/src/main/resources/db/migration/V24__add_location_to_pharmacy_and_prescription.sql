-- V24 — Rwanda administrative location fields
-- Adds sector + cell to pharmacies for precise nearest-pharmacy matching.
-- Adds delivery_district + delivery_sector + delivery_cell to prescriptions
-- so the cascade resolver (cell → sector → district → any) can run at issue time.

-- ── Pharmacies ──────────────────────────────────────────────────────────────
ALTER TABLE pharmacies
    ADD COLUMN IF NOT EXISTS sector VARCHAR(80),
    ADD COLUMN IF NOT EXISTS cell   VARCHAR(80);

-- Indexes for each level of the cascade
CREATE INDEX IF NOT EXISTS idx_pharmacies_district        ON pharmacies (LOWER(district)) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pharmacies_district_sector ON pharmacies (LOWER(district), LOWER(sector)) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pharmacies_district_sector_cell
    ON pharmacies (LOWER(district), LOWER(sector), LOWER(cell)) WHERE is_active = TRUE;

-- ── Prescriptions ────────────────────────────────────────────────────────────
ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS delivery_district VARCHAR(60),
    ADD COLUMN IF NOT EXISTS delivery_sector   VARCHAR(80),
    ADD COLUMN IF NOT EXISTS delivery_cell     VARCHAR(80);
