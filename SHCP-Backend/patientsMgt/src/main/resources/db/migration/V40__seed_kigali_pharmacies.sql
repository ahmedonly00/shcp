-- V40 — Seed 5 real licensed pharmacies in Kigali, Rwanda
-- Sources: Rwanda FDA Licensed Pharmacies list, Rwanda Yellow Pages, near-place.com
-- All inserts are idempotent (ON CONFLICT DO NOTHING).

INSERT INTO pharmacies (
    pharmacy_id, name, address, district, sector, cell,
    phone, email, latitude, longitude, is_active
)
VALUES
  -- 1. Pharmacie Conseil — Nyarugenge CBD (one of Kigali's largest community pharmacies)
  --    KN 78 St, Kigali Building Chadel, opposite ex-Ecole Belge
  (
    'c0000001-0000-0000-0000-000000000001',
    'Pharmacie Conseil',
    'KN 78 Street, Kigali Building Chadel (Opp. Ex-Ecole Belge)',
    'Nyarugenge',
    'Nyarugenge',
    'Gitega',
    '+250 788 308 200',
    'info@pharmacieconseil.org',
    -1.9503099,
    30.0593512,
    TRUE
  ),

  -- 2. Kipharma — Nyarugenge city centre, beside Nyarugenge Market
  --    KN 74 Street, one of Kigali's oldest wholesale/retail pharmacies
  (
    'c0000002-0000-0000-0000-000000000002',
    'Kipharma',
    'KN 74 Street, City Centre (beside Nyarugenge Market)',
    'Nyarugenge',
    'Nyarugenge',
    'Nyarugenge',
    '+250 252 575 536',
    NULL,
    -1.9527000,
    30.0582000,
    TRUE
  ),

  -- 3. Pharmacie Continentale — Remera / Kisimenti, Gasabo
  --    KG 1 Ave, Rukiri I sector, near Kisimenti roundabout
  (
    'c0000003-0000-0000-0000-000000000003',
    'Pharmacie Continentale',
    'KG 1 Avenue, Kisimenti, Remera',
    'Gasabo',
    'Remera',
    'Rukiri I',
    '+250 788 622 221',
    'pharmacie.continental@yahoo.fr',
    -1.9427000,
    30.1003000,
    TRUE
  ),

  -- 4. Adrenaline Pharmacy Ltd — Kabeza Modern Market, Kanombe sector, Kicukiro
  --    Open daily 7 AM – 11 PM; licensed NPC/A1189 (valid to 2030)
  (
    'c0000004-0000-0000-0000-000000000004',
    'Adrenaline Pharmacy Ltd',
    'Kabeza Modern Market, Kabeza, Kanombe',
    'Kicukiro',
    'Kanombe',
    'Kabeza',
    '+250 785 636 683',
    NULL,
    -1.9705900,
    30.1259000,
    TRUE
  ),

  -- 5. PharmaLab Ltd — KN 59 Street No. 24, Nyarugenge
  --    Full dispensary and pharmaceutical lab services
  (
    'c0000005-0000-0000-0000-000000000005',
    'PharmaLab Ltd',
    'KN 59 Street No. 24, Nyarugenge',
    'Nyarugenge',
    'Rwezamenyo',
    'Rwezamenyo',
    '+250 788 477 537',
    'pharmalabkgli@gmail.com',
    -1.9533000,
    30.0618000,
    TRUE
  )
ON CONFLICT (pharmacy_id) DO NOTHING;
