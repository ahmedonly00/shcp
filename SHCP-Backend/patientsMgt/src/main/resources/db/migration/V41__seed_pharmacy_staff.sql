-- V41 — Seed pharmacists and bikers for the 5 Kigali pharmacies added in V40.
--        One pharmacist + one biker per pharmacy (10 new users total).
--        All inserts are idempotent (ON CONFLICT DO NOTHING).
--        Login password for all seeded staff: Ahmed@123

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. User accounts
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO users (user_id, name, email, phone, role, password_hash, is_verified, language_pref, failed_login_attempts, locked_until)
VALUES
  -- Pharmacists
  ('d0000001-0000-0000-0000-000000000001', 'Marie Mukamana',        'marie.mukamana@yopmail.com',        '+250788400001', 'PHARMACIST', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('d0000002-0000-0000-0000-000000000002', 'Emmanuel Nzeyimana',    'emmanuel.nzeyimana.pharm@yopmail.com', '+250788400002', 'PHARMACIST', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('d0000003-0000-0000-0000-000000000003', 'Claudine Uwamariya',    'claudine.uwamariya@yopmail.com',    '+250788400003', 'PHARMACIST', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('d0000004-0000-0000-0000-000000000004', 'Patrick Habimana',      'patrick.habimana.ph@yopmail.com',   '+250788400004', 'PHARMACIST', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'en', 0, NULL),
  ('d0000005-0000-0000-0000-000000000005', 'Jacqueline Uwimana',    'jacqueline.uwimana@yopmail.com',    '+250788400005', 'PHARMACIST', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  -- Bikers
  ('e0000001-0000-0000-0000-000000000001', 'Jean-Paul Nshimiyimana','jeanpaul.nshimiyimana@yopmail.com', '+250788500001', 'BIKER',      '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('e0000002-0000-0000-0000-000000000002', 'Eric Mugisha',          'eric.mugisha.biker@yopmail.com',    '+250788500002', 'BIKER',      '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('e0000003-0000-0000-0000-000000000003', 'Celestin Bizimungu',    'celestin.bizimungu@yopmail.com',    '+250788500003', 'BIKER',      '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('e0000004-0000-0000-0000-000000000004', 'Placide Nkurunziza',    'placide.nkurunziza@yopmail.com',    '+250788500004', 'BIKER',      '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('e0000005-0000-0000-0000-000000000005', 'Bernard Kayitare',      'bernard.kayitare@yopmail.com',      '+250788500005', 'BIKER',      '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL)
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pharmacist profiles  (one per pharmacy)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO pharmacists (user_id, pharmacy_id)
VALUES
  ('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001'), -- Marie       → Pharmacie Conseil
  ('d0000002-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002'), -- Emmanuel    → Kipharma
  ('d0000003-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003'), -- Claudine    → Pharmacie Continentale
  ('d0000004-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004'), -- Patrick     → Adrenaline Pharmacy Ltd
  ('d0000005-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005')  -- Jacqueline  → PharmaLab Ltd
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Biker profiles  (one per pharmacy)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO bikers (user_id, pharmacy_id, license_number, vehicle_type, operating_zone, status)
VALUES
  ('e0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'RAA 001 A', 'Motorcycle', 'Nyarugenge',  'AVAILABLE'),
  ('e0000002-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', 'RAB 002 B', 'Motorcycle', 'Nyarugenge',  'AVAILABLE'),
  ('e0000003-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', 'RAC 003 C', 'Motorcycle', 'Remera',      'OFFLINE'),
  ('e0000004-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', 'RAD 004 D', 'Motorcycle', 'Kanombe',     'AVAILABLE'),
  ('e0000005-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', 'RAE 005 E', 'Motorcycle', 'Rwezamenyo',  'OFFLINE')
ON CONFLICT (user_id) DO NOTHING;
