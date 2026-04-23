-- V25 — GPS coordinates, pharmacy inventory, remove dead code
-- Gaps addressed:
--   #3  GPS distance-based tiebreaker
--   #4  Remove operating_zone (dead code)
--   #1  Medication inventory / stock tracking

-- ── Gap #4: remove operating_zone (dead code after sector/cell were added) ───
ALTER TABLE pharmacies DROP COLUMN IF EXISTS operating_zone;

-- ── Gap #3: GPS coordinates on pharmacies ────────────────────────────────────
ALTER TABLE pharmacies
    ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- GPS on delivery address so Haversine distance can be computed at issue time
ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS delivery_latitude  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;

-- Spatial index hint for future PostGIS upgrade path
CREATE INDEX IF NOT EXISTS idx_pharmacies_gps ON pharmacies (latitude, longitude) WHERE is_active = TRUE;

-- ── Gap #1: pharmacy_inventory ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    inventory_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id       UUID        NOT NULL REFERENCES pharmacies(pharmacy_id) ON DELETE CASCADE,
    medication_name   VARCHAR(200) NOT NULL,
    generic_name      VARCHAR(200),
    quantity_in_stock INTEGER     NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
    unit              VARCHAR(50) NOT NULL DEFAULT 'units',
    expiry_date       DATE,
    -- alert threshold: pharmacist is warned when stock falls to this level
    reorder_level     INTEGER     NOT NULL DEFAULT 10,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- one row per medication per pharmacy (case-insensitive deduplicated by application layer)
    CONSTRAINT uq_pharmacy_medication UNIQUE (pharmacy_id, medication_name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy   ON pharmacy_inventory(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inventory_name       ON pharmacy_inventory(LOWER(medication_name));
-- Partial index: only rows actually in stock (used by stock-check query)
CREATE INDEX IF NOT EXISTS idx_inventory_instock    ON pharmacy_inventory(pharmacy_id, LOWER(medication_name))
    WHERE quantity_in_stock > 0;
