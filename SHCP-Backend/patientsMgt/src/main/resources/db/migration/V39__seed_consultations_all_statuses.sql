-- V39 — Seed 12 completed consultations for Ahmed Doctor covering every
--        report filter status: Severe (EMERGENCY), Urgent (URGENT),
--        Moderate (ROUTINE), Cured (DELIVERED Rx), Not Cured (non-DELIVERED Rx).
--        Also adds 7 new patients so each consultation is with a distinct patient.
--        All inserts are idempotent (ON CONFLICT DO NOTHING).
--        Test password for all new patients: Ahmed@123

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New patient users  (a1000006 – a1000012)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO users (user_id, name, email, phone, role, password_hash, is_verified, language_pref, failed_login_attempts, locked_until)
VALUES
  ('a1000006-0000-0000-0000-000000000006', 'Innocent Habimana',   'innocent.habimana@yopmail.com',   '+250788100006', 'PATIENT', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('a1000007-0000-0000-0000-000000000007', 'Josephine Mukashema', 'josephine.mukashema@yopmail.com', '+250788100007', 'PATIENT', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'en', 0, NULL),
  ('a1000008-0000-0000-0000-000000000008', 'Patrick Nsengimana',  'patrick.nsengimana@yopmail.com',  '+250788100008', 'PATIENT', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('a1000009-0000-0000-0000-000000000009', 'Brigitte Uwera',      'brigitte.uwera@yopmail.com',      '+250788100009', 'PATIENT', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'en', 0, NULL),
  ('a1000010-0000-0000-0000-000000000010', 'Francois Bizimungu',  'francois.bizimungu@yopmail.com',  '+250788100010', 'PATIENT', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('a1000011-0000-0000-0000-000000000011', 'Solange Mukamurera',  'solange.mukamurera@yopmail.com',  '+250788100011', 'PATIENT', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'rw', 0, NULL),
  ('a1000012-0000-0000-0000-000000000012', 'Didier Nkurunziza',   'didier.nkurunziza@yopmail.com',   '+250788100012', 'PATIENT', '$2a$12$q8RZatVjZxBqAD9i8DyLcuCypXZksofwK7feV97H4AQAAkYweLZ1i', true, 'en', 0, NULL)
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Patient profiles
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO patients (user_id, date_of_birth, blood_type, insurance_number, national_id, gender, emergency_contact_name, emergency_contact_phone, insurance_provider)
VALUES
  ('a1000006-0000-0000-0000-000000000006', '1988-06-15', 'A+',  'RAMA-2024-10006', '1198870012345606', 'Male',   'Alice Habimana',    '+250788200006', 'RAMA'),
  ('a1000007-0000-0000-0000-000000000007', '1995-04-22', 'B+',  'MMI-2024-10007',  '1199570012345607', 'Female', 'Jean Mukashema',    '+250788200007', 'MMI'),
  ('a1000008-0000-0000-0000-000000000008', '1972-11-08', 'O+',  'RAMA-2024-10008', '1197270012345608', 'Male',   'Marie Nsengimana',  '+250788200008', 'RAMA'),
  ('a1000009-0000-0000-0000-000000000009', '1991-08-30', 'AB+', 'MMI-2024-10009',  '1199170012345609', 'Female', 'Claude Uwera',      '+250788200009', 'MMI'),
  ('a1000010-0000-0000-0000-000000000010', '1983-03-17', 'O-',  'RAMA-2024-10010', '1198370012345610', 'Male',   'Agnes Bizimungu',   '+250788200010', 'RAMA'),
  ('a1000011-0000-0000-0000-000000000011', '1998-12-05', 'A+',  'MMI-2024-10011',  '1199870012345611', 'Female', 'Paul Mukamurera',   '+250788200011', 'MMI'),
  ('a1000012-0000-0000-0000-000000000012', '1967-07-19', 'B+',  'RAMA-2024-10012', '1196770012345612', 'Male',   'Cecile Nkurunziza', '+250788200012', 'RAMA')
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Health records for new patients
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO health_records (record_id, patient_id, diagnoses, medications, allergies, vitals, immunizations, lab_results, documents, goals, activity_logs)
VALUES
  (
    'b1000006-0000-0000-0000-000000000006', 'a1000006-0000-0000-0000-000000000006',
    '[{"name":"Severe Sepsis","date":"2026-05-20","doctor":"Ahmed Doctor","notes":"Admitted for sepsis secondary to urinary tract infection"}]',
    '[{"name":"Ceftriaxone","dosage":"1g IV","frequency":"2x/day","duration":"7 days"},{"name":"Metronidazole","dosage":"500mg","frequency":"3x/day","duration":"7 days"}]',
    '["Penicillin"]',
    '{"height":"170","weight":"72","bloodPressure":"90/60","heartRate":"118","temperature":"39.8","oxygenSaturation":"92"}',
    '[{"vaccine":"COVID-19","date":"2022-09-10"}]',
    '[{"test":"Blood Culture","result":"E. coli positive","date":"2026-05-20"},{"test":"WBC","result":"18,000/µL","date":"2026-05-20"}]',
    '[]', '[{"goal":"Complete antibiotic course","status":"IN_PROGRESS"}]', '[]'
  ),
  (
    'b1000007-0000-0000-0000-000000000007', 'a1000007-0000-0000-0000-000000000007',
    '[{"name":"Severe Pneumonia","date":"2026-05-21","doctor":"Ahmed Doctor","notes":"Bilateral consolidation on chest X-ray, SpO2 88% on room air"}]',
    '[{"name":"Amoxicillin-Clavulanate","dosage":"875mg","frequency":"2x/day","duration":"10 days"},{"name":"Azithromycin","dosage":"500mg","frequency":"1x/day","duration":"5 days"}]',
    '[]',
    '{"height":"163","weight":"55","bloodPressure":"100/65","heartRate":"112","temperature":"39.2","oxygenSaturation":"88"}',
    '[{"vaccine":"COVID-19","date":"2022-06-15"},{"vaccine":"Pneumococcal","date":"2023-01-10"}]',
    '[{"test":"Chest X-ray","result":"Bilateral consolidation","date":"2026-05-21"},{"test":"Sputum Culture","result":"S. pneumoniae","date":"2026-05-21"}]',
    '[]', '[{"goal":"Oxygen saturation > 95%","status":"IN_PROGRESS"}]', '[]'
  ),
  (
    'b1000008-0000-0000-0000-000000000008', 'a1000008-0000-0000-0000-000000000008',
    '[{"name":"Acute Myocardial Infarction","date":"2026-05-22","doctor":"Ahmed Doctor","notes":"STEMI, referred to cardiac unit after initial stabilisation"}]',
    '[{"name":"Aspirin","dosage":"300mg","frequency":"1x/day","duration":"Ongoing"},{"name":"Clopidogrel","dosage":"75mg","frequency":"1x/day","duration":"Ongoing"}]',
    '["Heparin"]',
    '{"height":"175","weight":"88","bloodPressure":"85/55","heartRate":"105","temperature":"37.2","oxygenSaturation":"94"}',
    '[{"vaccine":"COVID-19","date":"2021-12-20"},{"vaccine":"Influenza","date":"2025-10-15"}]',
    '[{"test":"Troponin I","result":"8.4 ng/mL (elevated)","date":"2026-05-22"},{"test":"ECG","result":"ST elevation leads II, III, aVF","date":"2026-05-22"}]',
    '[]', '[{"goal":"Cardiac rehab programme","status":"IN_PROGRESS"}]', '[]'
  ),
  (
    'b1000009-0000-0000-0000-000000000009', 'a1000009-0000-0000-0000-000000000009',
    '[{"name":"Severe Urinary Tract Infection","date":"2026-05-23","doctor":"Ahmed Doctor","notes":"Complicated UTI with flank pain, high fever, positive urine culture"}]',
    '[{"name":"Ciprofloxacin","dosage":"500mg","frequency":"2x/day","duration":"7 days"},{"name":"Paracetamol","dosage":"1000mg","frequency":"3x/day","duration":"5 days"}]',
    '["Sulfonamides"]',
    '{"height":"161","weight":"58","bloodPressure":"105/68","heartRate":"98","temperature":"39.0","oxygenSaturation":"96"}',
    '[{"vaccine":"COVID-19","date":"2022-07-05"}]',
    '[{"test":"Urine Culture","result":"E. coli > 100,000 CFU/mL","date":"2026-05-23"},{"test":"CBC","result":"WBC 14,500/µL","date":"2026-05-23"}]',
    '[]', '[{"goal":"Adequate hydration 2L/day","status":"IN_PROGRESS"}]', '[]'
  ),
  (
    'b1000010-0000-0000-0000-000000000010', 'a1000010-0000-0000-0000-000000000010',
    '[{"name":"Seasonal Allergic Rhinitis","date":"2026-05-24","doctor":"Ahmed Doctor","notes":"Mild symptoms, triggered by pollen, managed with antihistamine"}]',
    '[{"name":"Loratadine","dosage":"10mg","frequency":"1x/day","duration":"PRN"}]',
    '["Amoxicillin"]',
    '{"height":"178","weight":"79","bloodPressure":"122/78","heartRate":"68","temperature":"36.7","oxygenSaturation":"99"}',
    '[{"vaccine":"COVID-19","date":"2022-08-12"},{"vaccine":"Influenza","date":"2025-09-20"}]',
    '[{"test":"Skin Prick Test","result":"Positive grass pollen","date":"2026-04-10"}]',
    '[]', '[{"goal":"Avoid allergen exposure","status":"IN_PROGRESS"}]', '[]'
  ),
  (
    'b1000011-0000-0000-0000-000000000011', 'a1000011-0000-0000-0000-000000000011',
    '[{"name":"Gastroenteritis","date":"2026-05-25","doctor":"Ahmed Doctor","notes":"Viral gastroenteritis, managed with rehydration and antiemetics"}]',
    '[{"name":"Oral Rehydration Salts","dosage":"1 sachet in 200ml","frequency":"After each loose stool","duration":"3 days"},{"name":"Metoclopramide","dosage":"10mg","frequency":"3x/day","duration":"2 days"}]',
    '[]',
    '{"height":"165","weight":"57","bloodPressure":"112/72","heartRate":"82","temperature":"37.8","oxygenSaturation":"98"}',
    '[{"vaccine":"COVID-19","date":"2022-05-25"},{"vaccine":"Typhoid","date":"2023-06-01"}]',
    '[{"test":"Stool Microscopy","result":"No ova or parasites","date":"2026-05-25"},{"test":"Rotavirus Antigen","result":"Negative","date":"2026-05-25"}]',
    '[]', '[{"goal":"Return to normal diet gradually","status":"ACHIEVED"}]', '[]'
  ),
  (
    'b1000012-0000-0000-0000-000000000012', 'a1000012-0000-0000-0000-000000000012',
    '[{"name":"Stroke (Ischaemic)","date":"2026-05-26","doctor":"Ahmed Doctor","notes":"Right-sided weakness and speech difficulty, NIHSS score 14, urgent neurology referral"}]',
    '[{"name":"Aspirin","dosage":"300mg","frequency":"1x/day","duration":"Ongoing"},{"name":"Atorvastatin","dosage":"40mg","frequency":"1x/day","duration":"Ongoing"}]',
    '["Warfarin"]',
    '{"height":"166","weight":"74","bloodPressure":"170/100","heartRate":"88","temperature":"36.9","oxygenSaturation":"95"}',
    '[{"vaccine":"COVID-19","date":"2022-01-30"}]',
    '[{"test":"CT Brain","result":"Ischaemic infarct left MCA territory","date":"2026-05-26"},{"test":"ECG","result":"Atrial fibrillation","date":"2026-05-26"}]',
    '[]', '[{"goal":"Physiotherapy daily","status":"IN_PROGRESS"}]', '[]'
  )
ON CONFLICT (patient_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Symptom reports for new patients (EMERGENCY × 3, URGENT × 1, SELF_CARE × 1, ROUTINE × 2)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO symptom_reports (report_id, patient_id, symptoms, symptom_text, language, ai_urgency, ai_pathway, ai_confidence, care_recommendation, ai_raw_response, created_at)
VALUES
  -- Innocent Habimana — EMERGENCY (Severe + Cured)
  (
    'fd000006-0000-0000-0000-000000000006', 'a1000006-0000-0000-0000-000000000006',
    '["high_fever","chills","confusion","low_blood_pressure","rapid_heartbeat"]',
    'I have very high fever, chills, I feel confused and my heart is racing. I am very weak.',
    'rw', 'EMERGENCY', 'EMERGENCY', 96.80,
    'This is a medical emergency. Go to the nearest hospital immediately. Do not wait.',
    '{"urgency":"EMERGENCY","confidence":96.8,"pathway":"EMERGENCY","care_recommendation":"Go to the nearest hospital immediately.","top_conditions":[{"condition":"Sepsis","probability":0.87},{"condition":"Malaria Severe","probability":0.10}]}'::jsonb,
    NOW() - INTERVAL '20 days'
  ),
  -- Josephine Mukashema — EMERGENCY (Severe + Not Cured)
  (
    'fd000007-0000-0000-0000-000000000007', 'a1000007-0000-0000-0000-000000000007',
    '["severe_cough","shortness_of_breath","chest_pain","high_fever","bluish_lips"]',
    'I have severe cough, cannot breathe well, my lips are turning blue and I have high fever.',
    'en', 'EMERGENCY', 'EMERGENCY', 94.50,
    'Critical respiratory distress. Call emergency services immediately or go to A&E now.',
    '{"urgency":"EMERGENCY","confidence":94.5,"pathway":"EMERGENCY","care_recommendation":"Call emergency services immediately.","top_conditions":[{"condition":"Severe Pneumonia","probability":0.82},{"condition":"Pulmonary Embolism","probability":0.12}]}'::jsonb,
    NOW() - INTERVAL '19 days'
  ),
  -- Patrick Nsengimana — EMERGENCY (Severe + Not Cured)
  (
    'fd000008-0000-0000-0000-000000000008', 'a1000008-0000-0000-0000-000000000008',
    '["chest_pain","left_arm_pain","sweating","nausea","shortness_of_breath"]',
    'Severe crushing chest pain spreading to my left arm, sweating heavily, feeling sick.',
    'rw', 'EMERGENCY', 'EMERGENCY', 97.20,
    'Possible heart attack. Call emergency services immediately. Chew aspirin 300mg if available. Do not drive.',
    '{"urgency":"EMERGENCY","confidence":97.2,"pathway":"EMERGENCY","care_recommendation":"Call emergency services immediately. Possible heart attack.","top_conditions":[{"condition":"Myocardial Infarction","probability":0.91},{"condition":"Unstable Angina","probability":0.07}]}'::jsonb,
    NOW() - INTERVAL '18 days'
  ),
  -- Brigitte Uwera — URGENT (Urgent + Cured)
  (
    'fd000009-0000-0000-0000-000000000009', 'a1000009-0000-0000-0000-000000000009',
    '["severe_flank_pain","high_fever","frequent_urination","burning_urination"]',
    'I have severe pain on my right side, high fever and burning when I urinate.',
    'en', 'URGENT', 'TELECONSULTATION', 89.40,
    'Urgent kidney infection suspected. Seek medical attention within 4 hours. Do not delay.',
    '{"urgency":"URGENT","confidence":89.4,"pathway":"TELECONSULTATION","care_recommendation":"Seek medical attention within 4 hours.","top_conditions":[{"condition":"Pyelonephritis","probability":0.83},{"condition":"Renal Calculus","probability":0.11}]}'::jsonb,
    NOW() - INTERVAL '17 days'
  ),
  -- Francois Bizimungu — SELF_CARE (Not Cured — cancelled Rx)
  (
    'fd000010-0000-0000-0000-000000000010', 'a1000010-0000-0000-0000-000000000010',
    '["runny_nose","sneezing","itchy_eyes","mild_headache"]',
    'Runny nose, sneezing and watery itchy eyes for the past week. Mild headache.',
    'rw', 'SELF_CARE', 'SELF_CARE', 87.30,
    'Likely seasonal allergies. Take over-the-counter antihistamine. Avoid allergen exposure. Return if symptoms worsen.',
    '{"urgency":"SELF_CARE","confidence":87.3,"pathway":"SELF_CARE","care_recommendation":"Take antihistamine. Avoid allergens.","top_conditions":[{"condition":"Allergic Rhinitis","probability":0.84},{"condition":"Viral URTI","probability":0.12}]}'::jsonb,
    NOW() - INTERVAL '16 days'
  ),
  -- Solange Mukamurera — ROUTINE (Moderate + Cured)
  (
    'fd000011-0000-0000-0000-000000000011', 'a1000011-0000-0000-0000-000000000011',
    '["nausea","vomiting","diarrhea","abdominal_cramps","mild_fever"]',
    'Nausea, vomiting and diarrhoea since yesterday, stomach cramps and low-grade fever.',
    'rw', 'ROUTINE', 'TELECONSULTATION', 81.60,
    'Likely gastroenteritis. Stay hydrated with ORS. Consult a doctor within 48 hours if no improvement.',
    '{"urgency":"ROUTINE","confidence":81.6,"pathway":"TELECONSULTATION","care_recommendation":"Hydration with ORS. Consult if no improvement in 48 hours.","top_conditions":[{"condition":"Viral Gastroenteritis","probability":0.76},{"condition":"Food Poisoning","probability":0.17}]}'::jsonb,
    NOW() - INTERVAL '15 days'
  ),
  -- Didier Nkurunziza — EMERGENCY (Severe + Not Cured — on the way Rx)
  (
    'fd000012-0000-0000-0000-000000000012', 'a1000012-0000-0000-0000-000000000012',
    '["sudden_weakness","speech_difficulty","facial_droop","severe_headache","confusion"]',
    'Sudden weakness on my right side, I cannot speak properly, my face is drooping, very severe headache.',
    'en', 'EMERGENCY', 'EMERGENCY', 98.10,
    'STROKE ALERT — Call emergency services immediately. Note the time symptoms started. Do not give food or water.',
    '{"urgency":"EMERGENCY","confidence":98.1,"pathway":"EMERGENCY","care_recommendation":"STROKE ALERT. Call emergency services immediately.","top_conditions":[{"condition":"Ischaemic Stroke","probability":0.92},{"condition":"Haemorrhagic Stroke","probability":0.07}]}'::jsonb,
    NOW() - INTERVAL '14 days'
  )
ON CONFLICT (report_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Appointments — all with Ahmed Doctor (02d83783-b4bc-4619-a642-ba066c516150)
--    Each row covers one of the 12 consultations we will seed.
--    Scheduled times are staggered across 4 days to avoid the no_double_booking constraint.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO appointments (appointment_id, patient_id, provider_id, scheduled_at, type, status, fee, payment_status)
VALUES
  -- Day 1: 2026-05-20
  ('ea000001-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-20 08:00:00+00', 'VIDEO',    'COMPLETED', 5000.00, 'PAID'),
  ('ea000002-0000-0000-0000-000000000002', 'a1000002-0000-0000-0000-000000000002', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-20 08:30:00+00', 'VIDEO',    'COMPLETED', 5000.00, 'PAID'),
  ('ea000003-0000-0000-0000-000000000003', 'a1000003-0000-0000-0000-000000000003', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-20 09:00:00+00', 'FOLLOWUP', 'COMPLETED', 3000.00, 'PAID'),
  -- Day 2: 2026-05-21
  ('ea000004-0000-0000-0000-000000000004', 'a1000004-0000-0000-0000-000000000004', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-21 08:00:00+00', 'FOLLOWUP', 'COMPLETED', 3000.00, 'PAID'),
  ('ea000005-0000-0000-0000-000000000005', 'a1000005-0000-0000-0000-000000000005', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-21 08:30:00+00', 'VIDEO',    'COMPLETED', 5000.00, 'PAID'),
  ('ea000006-0000-0000-0000-000000000006', 'a1000006-0000-0000-0000-000000000006', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-21 09:00:00+00', 'URGENT',   'COMPLETED', 7000.00, 'PAID'),
  -- Day 3: 2026-05-22
  ('ea000007-0000-0000-0000-000000000007', 'a1000007-0000-0000-0000-000000000007', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-22 08:00:00+00', 'URGENT',   'COMPLETED', 7000.00, 'PAID'),
  ('ea000008-0000-0000-0000-000000000008', 'a1000008-0000-0000-0000-000000000008', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-22 08:30:00+00', 'URGENT',   'COMPLETED', 7000.00, 'PAID'),
  ('ea000009-0000-0000-0000-000000000009', 'a1000009-0000-0000-0000-000000000009', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-22 09:00:00+00', 'VIDEO',    'COMPLETED', 5000.00, 'PAID'),
  -- Day 4: 2026-05-23
  ('ea000010-0000-0000-0000-000000000010', 'a1000010-0000-0000-0000-000000000010', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-23 08:00:00+00', 'VIDEO',    'COMPLETED', 5000.00, 'PAID'),
  ('ea000011-0000-0000-0000-000000000011', 'a1000011-0000-0000-0000-000000000011', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-23 08:30:00+00', 'FOLLOWUP', 'COMPLETED', 3000.00, 'PAID'),
  ('ea000012-0000-0000-0000-000000000012', 'a1000012-0000-0000-0000-000000000012', '02d83783-b4bc-4619-a642-ba066c516150', '2026-05-23 09:00:00+00', 'URGENT',   'COMPLETED', 7000.00, 'PAID')
ON CONFLICT (appointment_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Completed consultations linked to those appointments
--    created_at is set explicitly so they fall in the default "last 30 days" range.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO consultations (consultation_id, appointment_id, room_id, started_at, ended_at, duration_minutes, notes, status, created_at)
VALUES
  -- 1. Marie Uwimana — URGENT urgency, DELIVERED Rx → Urgent + Cured
  ('fb000001-0000-0000-0000-000000000001', 'ea000001-0000-0000-0000-000000000001',
   'room-v39-001', '2026-05-20 08:02:00+00', '2026-05-20 08:22:00+00', 20,
   'Patient presents with high fever and chills. Confirmed malaria. Prescribed Coartem. Patient to rest and increase fluid intake.',
   'COMPLETED', '2026-05-20 08:22:00+00'),

  -- 2. Jean Baptiste Habimana — URGENT urgency, PENDING Rx → Urgent + Not Cured
  ('fb000002-0000-0000-0000-000000000002', 'ea000002-0000-0000-0000-000000000002',
   'room-v39-002', '2026-05-20 08:32:00+00', '2026-05-20 08:57:00+00', 25,
   'Hypertensive crisis episode. BP 180/110 at start. Adjusted Amlodipine dose. Advised blood pressure monitoring twice daily.',
   'COMPLETED', '2026-05-20 08:57:00+00'),

  -- 3. Consolata Ingabire — ROUTINE urgency, DELIVERED Rx → Moderate + Cured
  ('fb000003-0000-0000-0000-000000000003', 'ea000003-0000-0000-0000-000000000003',
   'room-v39-003', '2026-05-20 09:02:00+00', '2026-05-20 09:17:00+00', 15,
   'Follow-up for acute bronchitis. Symptoms improving. Prescribed Ambroxol for residual cough. Inhaler technique reviewed.',
   'COMPLETED', '2026-05-20 09:17:00+00'),

  -- 4. Emmanuel Nzeyimana — ROUTINE urgency, ON_THE_WAY Rx → Moderate + Not Cured
  ('fb000004-0000-0000-0000-000000000004', 'ea000004-0000-0000-0000-000000000004',
   'room-v39-004', '2026-05-21 08:02:00+00', '2026-05-21 08:32:00+00', 30,
   'Diabetes follow-up. HbA1c slightly elevated at 7.4%. Increased Metformin dose. Diet counselling provided.',
   'COMPLETED', '2026-05-21 08:32:00+00'),

  -- 5. Claudine Mukamana — SELF_CARE urgency, DELIVERED Rx → Cured
  ('fb000005-0000-0000-0000-000000000005', 'ea000005-0000-0000-0000-000000000005',
   'room-v39-005', '2026-05-21 08:32:00+00', '2026-05-21 08:47:00+00', 15,
   'Tension headache follow-up. Stress management discussed. Paracetamol course completed successfully.',
   'COMPLETED', '2026-05-21 08:47:00+00'),

  -- 6. Innocent Habimana — EMERGENCY urgency, DELIVERED Rx → Severe + Cured
  ('fb000006-0000-0000-0000-000000000006', 'ea000006-0000-0000-0000-000000000006',
   'room-v39-006', '2026-05-21 09:02:00+00', '2026-05-21 09:32:00+00', 30,
   'Sepsis case — patient stabilised with IV antibiotics. Blood cultures growing E. coli. Full antibiotic course dispensed and delivered.',
   'COMPLETED', '2026-05-21 09:32:00+00'),

  -- 7. Josephine Mukashema — EMERGENCY urgency, PROCESSING Rx → Severe + Not Cured
  ('fb000007-0000-0000-0000-000000000007', 'ea000007-0000-0000-0000-000000000007',
   'room-v39-007', '2026-05-22 08:02:00+00', '2026-05-22 08:27:00+00', 25,
   'Severe pneumonia. SpO2 88%. Prescribed dual antibiotic therapy. Pharmacy currently processing the order.',
   'COMPLETED', '2026-05-22 08:27:00+00'),

  -- 8. Patrick Nsengimana — EMERGENCY urgency, PENDING Rx → Severe + Not Cured
  ('fb000008-0000-0000-0000-000000000008', 'ea000008-0000-0000-0000-000000000008',
   'room-v39-008', '2026-05-22 08:32:00+00', '2026-05-22 08:52:00+00', 20,
   'STEMI presentation. Patient stabilised. Referred to cardiac unit. Antiplatelet therapy prescribed but not yet dispensed.',
   'COMPLETED', '2026-05-22 08:52:00+00'),

  -- 9. Brigitte Uwera — URGENT urgency, DELIVERED Rx → Urgent + Cured
  ('fb000009-0000-0000-0000-000000000009', 'ea000009-0000-0000-0000-000000000009',
   'room-v39-009', '2026-05-22 09:02:00+00', '2026-05-22 09:22:00+00', 20,
   'Pyelonephritis. High fever and flank pain. Prescribed Ciprofloxacin 7-day course. Medication delivered — patient improving.',
   'COMPLETED', '2026-05-22 09:22:00+00'),

  -- 10. Francois Bizimungu — SELF_CARE urgency, CANCELLED Rx → Not Cured
  ('fb000010-0000-0000-0000-000000000010', 'ea000010-0000-0000-0000-000000000010',
   'room-v39-010', '2026-05-23 08:02:00+00', '2026-05-23 08:17:00+00', 15,
   'Allergic rhinitis — patient declined prescription after stating he already has Loratadine at home. Prescription cancelled at patient request.',
   'COMPLETED', '2026-05-23 08:17:00+00'),

  -- 11. Solange Mukamurera — ROUTINE urgency, DELIVERED Rx → Moderate + Cured
  ('fb000011-0000-0000-0000-000000000011', 'ea000011-0000-0000-0000-000000000011',
   'room-v39-011', '2026-05-23 08:32:00+00', '2026-05-23 08:52:00+00', 20,
   'Viral gastroenteritis. Prescribed ORS and antiemetics. Medications delivered. Patient tolerating fluids well.',
   'COMPLETED', '2026-05-23 08:52:00+00'),

  -- 12. Didier Nkurunziza — EMERGENCY urgency, ON_THE_WAY Rx → Severe + Not Cured
  ('fb000012-0000-0000-0000-000000000012', 'ea000012-0000-0000-0000-000000000012',
   'room-v39-012', '2026-05-23 09:02:00+00', '2026-05-23 09:32:00+00', 30,
   'Acute ischaemic stroke. Right-sided weakness, NIHSS 14. Antiplatelet therapy prescribed. Medication currently on the way.',
   'COMPLETED', '2026-05-23 09:32:00+00')
ON CONFLICT (consultation_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Prescriptions linked to each consultation
--    Status determines Cured (DELIVERED) vs Not Cured (everything else).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO prescriptions (prescription_id, consultation_id, patient_id, provider_id, medications, instructions, issued_at, valid_until, status)
VALUES
  -- 1. Marie — DELIVERED → Cured
  (
    'ec000001-0000-0000-0000-000000000001',
    'fb000001-0000-0000-0000-000000000001',
    'a1000001-0000-0000-0000-000000000001',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Coartem","dosage":"80/480mg","frequency":"2x/day","durationDays":3},{"name":"Paracetamol","dosage":"1000mg","frequency":"3x/day","durationDays":3}]',
    'Take Coartem with food or milk. Do not skip doses. Rest and increase fluid intake.',
    '2026-05-20 08:22:00+00', '2026-06-19', 'DELIVERED'
  ),
  -- 2. Jean Baptiste — PENDING → Not Cured
  (
    'ec000002-0000-0000-0000-000000000002',
    'fb000002-0000-0000-0000-000000000002',
    'a1000002-0000-0000-0000-000000000002',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Amlodipine","dosage":"10mg","frequency":"1x/day","durationDays":30},{"name":"Hydrochlorothiazide","dosage":"25mg","frequency":"1x/day","durationDays":30}]',
    'Take Amlodipine in the evening. Monitor blood pressure daily. Reduce salt intake.',
    '2026-05-20 08:57:00+00', '2026-06-19', 'PENDING'
  ),
  -- 3. Consolata — DELIVERED → Cured
  (
    'ec000003-0000-0000-0000-000000000003',
    'fb000003-0000-0000-0000-000000000003',
    'a1000003-0000-0000-0000-000000000003',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Ambroxol","dosage":"30mg","frequency":"3x/day","durationDays":5},{"name":"Salbutamol inhaler","dosage":"100mcg","frequency":"As needed","durationDays":14}]',
    'Ambroxol helps loosen mucus — take with plenty of water. Use inhaler only when breathless.',
    '2026-05-20 09:17:00+00', '2026-06-19', 'DELIVERED'
  ),
  -- 4. Emmanuel — ON_THE_WAY → Not Cured
  (
    'ec000004-0000-0000-0000-000000000004',
    'fb000004-0000-0000-0000-000000000004',
    'a1000004-0000-0000-0000-000000000004',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Metformin","dosage":"1000mg","frequency":"2x/day","durationDays":30},{"name":"Glibenclamide","dosage":"5mg","frequency":"1x/day","durationDays":30}]',
    'Take Metformin with meals. Monitor blood glucose daily. Return in 30 days for HbA1c.',
    '2026-05-21 08:32:00+00', '2026-06-20', 'ON_THE_WAY'
  ),
  -- 5. Claudine — DELIVERED → Cured
  (
    'ec000005-0000-0000-0000-000000000005',
    'fb000005-0000-0000-0000-000000000005',
    'a1000005-0000-0000-0000-000000000005',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Paracetamol","dosage":"1000mg","frequency":"As needed (max 4x/day)","durationDays":5}]',
    'Take with water. Do not exceed 4g in 24 hours. Avoid alcohol.',
    '2026-05-21 08:47:00+00', '2026-06-20', 'DELIVERED'
  ),
  -- 6. Innocent — DELIVERED → Cured
  (
    'ec000006-0000-0000-0000-000000000006',
    'fb000006-0000-0000-0000-000000000006',
    'a1000006-0000-0000-0000-000000000006',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Ceftriaxone","dosage":"1g","frequency":"2x/day","durationDays":7},{"name":"Metronidazole","dosage":"500mg","frequency":"3x/day","durationDays":7}]',
    'Complete the full antibiotic course. Rest and increase fluid intake. Return immediately if fever returns.',
    '2026-05-21 09:32:00+00', '2026-06-20', 'DELIVERED'
  ),
  -- 7. Josephine — PROCESSING → Not Cured
  (
    'ec000007-0000-0000-0000-000000000007',
    'fb000007-0000-0000-0000-000000000007',
    'a1000007-0000-0000-0000-000000000007',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Amoxicillin-Clavulanate","dosage":"875mg","frequency":"2x/day","durationDays":10},{"name":"Azithromycin","dosage":"500mg","frequency":"1x/day","durationDays":5}]',
    'Take Amoxicillin-Clavulanate with food. Complete full course. Return if SpO2 drops below 94%.',
    '2026-05-22 08:27:00+00', '2026-06-21', 'PROCESSING'
  ),
  -- 8. Patrick — PENDING → Not Cured
  (
    'ec000008-0000-0000-0000-000000000008',
    'fb000008-0000-0000-0000-000000000008',
    'a1000008-0000-0000-0000-000000000008',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Aspirin","dosage":"300mg","frequency":"1x/day","durationDays":90},{"name":"Clopidogrel","dosage":"75mg","frequency":"1x/day","durationDays":90}]',
    'Take both medications daily. Do not stop without consulting your cardiologist. Report any unusual bleeding.',
    '2026-05-22 08:52:00+00', '2026-08-20', 'PENDING'
  ),
  -- 9. Brigitte — DELIVERED → Cured
  (
    'ec000009-0000-0000-0000-000000000009',
    'fb000009-0000-0000-0000-000000000009',
    'a1000009-0000-0000-0000-000000000009',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Ciprofloxacin","dosage":"500mg","frequency":"2x/day","durationDays":7},{"name":"Paracetamol","dosage":"1000mg","frequency":"3x/day","durationDays":5}]',
    'Take Ciprofloxacin with plenty of water. Complete the full 7-day course. Avoid dairy products 2 hours before/after dose.',
    '2026-05-22 09:22:00+00', '2026-06-21', 'DELIVERED'
  ),
  -- 10. Francois — CANCELLED → Not Cured
  (
    'ec000010-0000-0000-0000-000000000010',
    'fb000010-0000-0000-0000-000000000010',
    'a1000010-0000-0000-0000-000000000010',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Loratadine","dosage":"10mg","frequency":"1x/day","durationDays":14}]',
    'Take once daily. Avoid known allergens. Return if symptoms persist beyond 2 weeks.',
    '2026-05-23 08:17:00+00', '2026-06-22', 'CANCELLED'
  ),
  -- 11. Solange — DELIVERED → Cured
  (
    'ec000011-0000-0000-0000-000000000011',
    'fb000011-0000-0000-0000-000000000011',
    'a1000011-0000-0000-0000-000000000011',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"ORS Sachets","dosage":"1 sachet in 200ml water","frequency":"After each loose stool","durationDays":3},{"name":"Metoclopramide","dosage":"10mg","frequency":"3x/day","durationDays":2}]',
    'Drink ORS after every loose stool. Take Metoclopramide 30 minutes before meals. Avoid solid food initially.',
    '2026-05-23 08:52:00+00', '2026-06-22', 'DELIVERED'
  ),
  -- 12. Didier — ON_THE_WAY → Not Cured
  (
    'ec000012-0000-0000-0000-000000000012',
    'fb000012-0000-0000-0000-000000000012',
    'a1000012-0000-0000-0000-000000000012',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Aspirin","dosage":"300mg","frequency":"1x/day","durationDays":90},{"name":"Atorvastatin","dosage":"40mg","frequency":"1x/day","durationDays":90}]',
    'Take Aspirin in the morning. Take Atorvastatin at night. Do not stop antiplatelet therapy without neurology advice.',
    '2026-05-23 09:32:00+00', '2026-08-21', 'ON_THE_WAY'
  )
ON CONFLICT (prescription_id) DO NOTHING;
