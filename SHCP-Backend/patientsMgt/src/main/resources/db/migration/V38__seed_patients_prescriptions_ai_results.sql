-- V38 — Seed 5 additional patients with profiles, health records,
--        symptom reports (with AI results), and prescriptions.
--        Also enriches existing patient's health record and AI results.
--        All inserts are idempotent (ON CONFLICT DO NOTHING).
--        Test password for all new patients: Patient@1234

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New patient users
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO users (user_id, name, email, phone, role, password_hash, is_verified, language_pref, failed_login_attempts, locked_until)
VALUES
  ('a1000001-0000-0000-0000-000000000001', 'Marie Uwimana',         'marie.uwimana@yopmail.com',        '+250788100001', 'PATIENT', '$2b$12$j3pvKw5qfZm8ZodWfqbitubgiz5ASMeURePcIpod97YojNoTQpUgG', true, 'rw', 0, NULL),
  ('a1000002-0000-0000-0000-000000000002', 'Jean Baptiste Habimana','jean.habimana@yopmail.com',         '+250788100002', 'PATIENT', '$2b$12$j3pvKw5qfZm8ZodWfqbitubgiz5ASMeURePcIpod97YojNoTQpUgG', true, 'en', 0, NULL),
  ('a1000003-0000-0000-0000-000000000003', 'Consolata Ingabire',    'consolata.ingabire@yopmail.com',    '+250788100003', 'PATIENT', '$2b$12$j3pvKw5qfZm8ZodWfqbitubgiz5ASMeURePcIpod97YojNoTQpUgG', true, 'rw', 0, NULL),
  ('a1000004-0000-0000-0000-000000000004', 'Emmanuel Nzeyimana',    'emmanuel.nzeyimana@yopmail.com',    '+250788100004', 'PATIENT', '$2b$12$j3pvKw5qfZm8ZodWfqbitubgiz5ASMeURePcIpod97YojNoTQpUgG', true, 'en', 0, NULL),
  ('a1000005-0000-0000-0000-000000000005', 'Claudine Mukamana',     'claudine.mukamana@yopmail.com',     '+250788100005', 'PATIENT', '$2b$12$j3pvKw5qfZm8ZodWfqbitubgiz5ASMeURePcIpod97YojNoTQpUgG', true, 'rw', 0, NULL)
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Patient profiles
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO patients (user_id, date_of_birth, blood_type, insurance_number, national_id, gender, emergency_contact_name, emergency_contact_phone, insurance_provider)
VALUES
  ('a1000001-0000-0000-0000-000000000001', '1994-03-12', 'A+',  'RAMA-2024-10001', '1199470012345601', 'Female', 'Pierre Uwimana',   '+250788200001', 'RAMA'),
  ('a1000002-0000-0000-0000-000000000002', '1979-07-22', 'O+',  'MMI-2024-10002',  '1197970012345602', 'Male',   'Grace Habimana',   '+250788200002', 'MMI'),
  ('a1000003-0000-0000-0000-000000000003', '1996-11-05', 'B+',  'RAMA-2024-10003', '1199670012345603', 'Female', 'Patrick Ingabire', '+250788200003', 'RAMA'),
  ('a1000004-0000-0000-0000-000000000004', '1969-02-18', 'AB+', 'MMI-2024-10004',  '1196970012345604', 'Male',   'Diane Nzeyimana',  '+250788200004', 'MMI'),
  ('a1000005-0000-0000-0000-000000000005', '1986-09-30', 'O-',  'RAMA-2024-10005', '1198670012345605', 'Female', 'Robert Mukamana',  '+250788200005', 'RAMA')
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Health records for new patients
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO health_records (record_id, patient_id, diagnoses, medications, allergies, vitals, immunizations, lab_results, documents, goals, activity_logs)
VALUES
  (
    'b1000001-0000-0000-0000-000000000001',
    'a1000001-0000-0000-0000-000000000001',
    '[{"name":"Malaria","date":"2026-02-10","doctor":"Ahmed Doctor","notes":"Confirmed P. falciparum, treated with Coartem"}]',
    '[{"name":"Coartem","dosage":"80/480mg","frequency":"2x/day","duration":"3 days"}]',
    '["Penicillin"]',
    '{"height":"163","weight":"58","bloodPressure":"110/70","heartRate":"88","temperature":"38.2","oxygenSaturation":"97"}',
    '[{"vaccine":"COVID-19","date":"2022-06-01"},{"vaccine":"Yellow Fever","date":"2020-03-15"}]',
    '[{"test":"Malaria RDT","result":"Positive","date":"2026-02-10"},{"test":"Hemoglobin","result":"10.2 g/dL","date":"2026-02-10"}]',
    '[]',
    '[{"goal":"Increase iron intake","status":"IN_PROGRESS"}]',
    '[]'
  ),
  (
    'b1000002-0000-0000-0000-000000000002',
    'a1000002-0000-0000-0000-000000000002',
    '[{"name":"Hypertension","date":"2025-08-20","doctor":"Cardiology Doctor","notes":"Stage 1, on Amlodipine"},{"name":"Type 2 Diabetes","date":"2025-08-20","doctor":"Cardiology Doctor","notes":"HbA1c 7.2%, diet-controlled"}]',
    '[{"name":"Amlodipine","dosage":"5mg","frequency":"1x/day","duration":"Ongoing"},{"name":"Metformin","dosage":"500mg","frequency":"2x/day","duration":"Ongoing"}]',
    '["Sulfonamides"]',
    '{"height":"172","weight":"82","bloodPressure":"148/92","heartRate":"78","temperature":"36.8","oxygenSaturation":"96"}',
    '[{"vaccine":"COVID-19","date":"2022-04-10"},{"vaccine":"Influenza","date":"2025-10-01"}]',
    '[{"test":"HbA1c","result":"7.2%","date":"2026-01-15"},{"test":"Lipid Panel","result":"LDL 145 mg/dL","date":"2026-01-15"},{"test":"ECG","result":"Normal sinus rhythm","date":"2026-01-15"}]',
    '[]',
    '[{"goal":"Reduce sodium intake","status":"IN_PROGRESS"},{"goal":"30 min walk daily","status":"ACHIEVED"}]',
    '[]'
  ),
  (
    'b1000003-0000-0000-0000-000000000003',
    'a1000003-0000-0000-0000-000000000003',
    '[{"name":"Acute Bronchitis","date":"2026-04-05","doctor":"Internal Doctor","notes":"Viral bronchitis, resolved with supportive care"}]',
    '[]',
    '["Aspirin","Ibuprofen"]',
    '{"height":"158","weight":"52","bloodPressure":"115/75","heartRate":"76","temperature":"36.6","oxygenSaturation":"98"}',
    '[{"vaccine":"COVID-19","date":"2022-07-20"},{"vaccine":"Tetanus","date":"2021-09-10"}]',
    '[{"test":"Chest X-ray","result":"No consolidation, mild bronchial thickening","date":"2026-04-05"},{"test":"Sputum Culture","result":"No pathogen isolated","date":"2026-04-06"}]',
    '[]',
    '[{"goal":"Quit smoking","status":"ACHIEVED"},{"goal":"Daily inhaler use","status":"IN_PROGRESS"}]',
    '[]'
  ),
  (
    'b1000004-0000-0000-0000-000000000004',
    'a1000004-0000-0000-0000-000000000004',
    '[{"name":"Type 2 Diabetes","date":"2022-11-03","doctor":"Internal Doctor","notes":"Well-controlled on Metformin + Glibenclamide"},{"name":"Osteoarthritis","date":"2024-03-20","doctor":"Internal Doctor","notes":"Right knee, managed with physiotherapy"}]',
    '[{"name":"Metformin","dosage":"1000mg","frequency":"2x/day","duration":"Ongoing"},{"name":"Glibenclamide","dosage":"5mg","frequency":"1x/day","duration":"Ongoing"}]',
    '["NSAIDs"]',
    '{"height":"168","weight":"76","bloodPressure":"130/82","heartRate":"70","temperature":"36.4","oxygenSaturation":"97"}',
    '[{"vaccine":"COVID-19","date":"2021-12-15"},{"vaccine":"Hepatitis B","date":"2019-05-10"}]',
    '[{"test":"HbA1c","result":"6.8%","date":"2026-03-01"},{"test":"Creatinine","result":"1.1 mg/dL","date":"2026-03-01"},{"test":"Urine Microalbumin","result":"25 mg/L","date":"2026-03-01"}]',
    '[]',
    '[{"goal":"Physiotherapy 3x/week","status":"IN_PROGRESS"},{"goal":"Blood sugar < 7 mmol/L","status":"ACHIEVED"}]',
    '[]'
  ),
  (
    'b1000005-0000-0000-0000-000000000005',
    'a1000005-0000-0000-0000-000000000005',
    '[{"name":"Tension Headache","date":"2026-05-20","doctor":"Internal Doctor","notes":"Recurrent, stress-related, responds to Paracetamol"}]',
    '[{"name":"Paracetamol","dosage":"1000mg","frequency":"As needed","duration":"PRN"}]',
    '[]',
    '{"height":"161","weight":"61","bloodPressure":"118/76","heartRate":"72","temperature":"37.0","oxygenSaturation":"99"}',
    '[{"vaccine":"COVID-19","date":"2022-05-15"},{"vaccine":"HPV","date":"2015-10-01"}]',
    '[{"test":"CBC","result":"Normal","date":"2026-05-20"},{"test":"Thyroid Function","result":"Normal","date":"2026-05-20"}]',
    '[]',
    '[{"goal":"Stress management techniques","status":"IN_PROGRESS"},{"goal":"Regular sleep schedule","status":"IN_PROGRESS"}]',
    '[]'
  )
ON CONFLICT (patient_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Enrich existing patient health record with realistic data
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE health_records SET
  diagnoses     = '[{"name":"Upper Respiratory Tract Infection","date":"2026-05-01","doctor":"Ahmed Doctor","notes":"Viral, self-limiting"}]',
  medications   = '[]',
  allergies     = '["Penicillin"]',
  vitals        = '{"height":"175","weight":"70","bloodPressure":"120/80","heartRate":"72","temperature":"36.8","oxygenSaturation":"98"}',
  immunizations = '[{"vaccine":"COVID-19","date":"2022-08-07"},{"vaccine":"Tetanus","date":"2021-01-15"}]',
  lab_results   = '[{"test":"Malaria RDT","result":"Negative","date":"2026-05-01"},{"test":"CBC","result":"Normal","date":"2026-05-01"}]'
WHERE patient_id = '2c5dd751-2d44-4b94-ba4f-4be1f0402fbf';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Update existing patient's symptom reports with proper AI results
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE symptom_reports SET
  ai_urgency           = 'ROUTINE',
  ai_pathway           = 'TELECONSULTATION',
  ai_confidence        = 72.30,
  care_recommendation  = 'Schedule a teleconsultation within 48 hours. Monitor symptoms and stay hydrated.',
  ai_raw_response      = '{"urgency":"ROUTINE","confidence":72.3,"pathway":"TELECONSULTATION","care_recommendation":"Schedule a teleconsultation within 48 hours.","top_conditions":[{"condition":"Upper Respiratory Tract Infection","probability":0.52},{"condition":"Sinusitis","probability":0.21}]}'
WHERE report_id = '41ce60c3-dc25-49ad-83c1-ee587551d482';

UPDATE symptom_reports SET
  ai_urgency           = 'SELF_CARE',
  ai_pathway           = 'SELF_CARE',
  ai_confidence        = 85.10,
  care_recommendation  = 'Rest, increase fluid intake, and use paracetamol as needed. Monitor for 48 hours.',
  ai_raw_response      = '{"urgency":"SELF_CARE","confidence":85.1,"pathway":"SELF_CARE","care_recommendation":"Rest and hydration recommended.","top_conditions":[{"condition":"Common Cold","probability":0.71},{"condition":"Mild Fatigue","probability":0.18}]}'
WHERE report_id = '02ede898-a3ab-461f-9097-6482e7a2fdee';

UPDATE symptom_reports SET
  ai_urgency           = 'ROUTINE',
  ai_pathway           = 'IN_PERSON',
  ai_confidence        = 68.50,
  care_recommendation  = 'Visit a clinic within 3 days for examination. Avoid strenuous activity.',
  ai_raw_response      = '{"urgency":"ROUTINE","confidence":68.5,"pathway":"IN_PERSON","care_recommendation":"Visit a clinic within 3 days.","top_conditions":[{"condition":"Gastroenteritis","probability":0.45},{"condition":"Irritable Bowel Syndrome","probability":0.23}]}'
WHERE report_id = 'f6d5ff2d-c6e9-47b9-90a9-a92ec2ddfc7f';

UPDATE symptom_reports SET
  ai_urgency           = 'URGENT',
  ai_pathway           = 'EMERGENCY',
  ai_confidence        = 91.20,
  care_recommendation  = 'Seek immediate medical attention. High fever with severe symptoms requires urgent evaluation.',
  ai_raw_response      = '{"urgency":"URGENT","confidence":91.2,"pathway":"EMERGENCY","care_recommendation":"Seek immediate medical attention.","top_conditions":[{"condition":"Malaria","probability":0.82},{"condition":"Typhoid Fever","probability":0.10}]}'
WHERE report_id = '2d56269f-adb4-41f0-b346-b59126277ac8';

UPDATE symptom_reports SET
  ai_urgency           = 'SELF_CARE',
  ai_pathway           = 'SELF_CARE',
  ai_confidence        = 79.80,
  care_recommendation  = 'Mild symptoms. Rest, paracetamol for fever. Return if symptoms worsen after 48 hours.',
  ai_raw_response      = '{"urgency":"SELF_CARE","confidence":79.8,"pathway":"SELF_CARE","care_recommendation":"Mild symptoms. Rest and paracetamol.","top_conditions":[{"condition":"Viral Upper Respiratory Infection","probability":0.68},{"condition":"Allergic Rhinitis","probability":0.15}]}'
WHERE report_id = '91d36042-618d-4e67-b901-a23d4160500f';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Symptom reports with AI results for new patients
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO symptom_reports (report_id, patient_id, symptoms, symptom_text, language, ai_urgency, ai_pathway, ai_confidence, care_recommendation, ai_raw_response)
VALUES
  (
    'c1000001-0000-0000-0000-000000000001',
    'a1000001-0000-0000-0000-000000000001',
    '["fever","chills","headache","sweating","fatigue","nausea"]',
    'I have had high fever and chills for two days, severe headache and sweating at night.',
    'rw',
    'URGENT',
    'TELECONSULTATION',
    88.50,
    'Your symptoms are consistent with malaria. Seek medical care within 24 hours for a rapid test. Do not delay treatment.',
    '{"urgency":"URGENT","confidence":88.5,"pathway":"TELECONSULTATION","care_recommendation":"Seek medical care within 24 hours for malaria test.","top_conditions":[{"condition":"Malaria","probability":0.885},{"condition":"Dengue Fever","probability":0.08}]}'
  ),
  (
    'c1000002-0000-0000-0000-000000000002',
    'a1000002-0000-0000-0000-000000000002',
    '["chest_pain","shortness_of_breath","dizziness","palpitation"]',
    'Chest pressure and shortness of breath when climbing stairs, dizzy spells in the morning.',
    'en',
    'URGENT',
    'EMERGENCY',
    93.10,
    'Your symptoms require urgent evaluation. Go to the nearest hospital immediately. Do not drive yourself.',
    '{"urgency":"URGENT","confidence":93.1,"pathway":"EMERGENCY","care_recommendation":"Go to the nearest hospital immediately.","top_conditions":[{"condition":"Hypertensive Crisis","probability":0.65},{"condition":"Unstable Angina","probability":0.25}]}'
  ),
  (
    'c1000003-0000-0000-0000-000000000003',
    'a1000003-0000-0000-0000-000000000003',
    '["cough","shortness_of_breath","sputum","fatigue"]',
    'Persistent cough with yellow sputum for a week, feeling breathless after mild activity.',
    'rw',
    'ROUTINE',
    'TELECONSULTATION',
    76.40,
    'Schedule a teleconsultation within 48 hours. A chest examination may be needed. Stay hydrated and rest.',
    '{"urgency":"ROUTINE","confidence":76.4,"pathway":"TELECONSULTATION","care_recommendation":"Schedule a teleconsultation within 48 hours.","top_conditions":[{"condition":"Acute Bronchitis","probability":0.62},{"condition":"Pneumonia","probability":0.18}]}'
  ),
  (
    'c1000004-0000-0000-0000-000000000004',
    'a1000004-0000-0000-0000-000000000004',
    '["polyuria","polydipsia","fatigue","blurred_vision"]',
    'Increased urination and thirst for 3 days, blurred vision and unusual tiredness.',
    'en',
    'ROUTINE',
    'IN_PERSON',
    82.30,
    'These symptoms suggest blood sugar may be elevated. Visit your clinic within 24 hours for a glucose check. Take your medications as prescribed.',
    '{"urgency":"ROUTINE","confidence":82.3,"pathway":"IN_PERSON","care_recommendation":"Visit clinic within 24 hours for glucose check.","top_conditions":[{"condition":"Hyperglycemia","probability":0.78},{"condition":"Urinary Tract Infection","probability":0.12}]}'
  ),
  (
    'c1000005-0000-0000-0000-000000000005',
    'a1000005-0000-0000-0000-000000000005',
    '["headache","fatigue","neck_stiffness"]',
    'Headache at the back of my head, stiff neck after long hours at the computer, feeling tired.',
    'rw',
    'SELF_CARE',
    'SELF_CARE',
    80.60,
    'Likely tension headache. Take paracetamol 500mg, rest, and apply a warm compress to the neck. Return if pain worsens or fever develops.',
    '{"urgency":"SELF_CARE","confidence":80.6,"pathway":"SELF_CARE","care_recommendation":"Paracetamol, rest, warm compress. Return if pain worsens.","top_conditions":[{"condition":"Tension Headache","probability":0.76},{"condition":"Cervical Muscle Strain","probability":0.14}]}'
  )
ON CONFLICT (report_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Prescriptions for all 6 patients
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO prescriptions (prescription_id, patient_id, provider_id, medications, instructions, issued_at, valid_until, status)
VALUES
  (
    'd1000001-0000-0000-0000-000000000001',
    '2c5dd751-2d44-4b94-ba4f-4be1f0402fbf',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Amoxicillin","dosage":"500mg","frequency":"3x/day","durationDays":7},{"name":"Paracetamol","dosage":"1000mg","frequency":"3x/day","durationDays":5}]',
    'Take Amoxicillin with food. Complete the full course. Paracetamol only when temperature exceeds 38.5°C.',
    NOW() - INTERVAL '10 days',
    CURRENT_DATE + INTERVAL '20 days',
    'DELIVERED'
  ),
  (
    'd1000002-0000-0000-0000-000000000002',
    'a1000001-0000-0000-0000-000000000001',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Coartem","dosage":"80/480mg","frequency":"2x/day","durationDays":3},{"name":"Paracetamol","dosage":"1000mg","frequency":"3x/day","durationDays":3}]',
    'Take Coartem with food or milk. Do not skip doses. Rest and increase fluid intake.',
    NOW() - INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '25 days',
    'DELIVERED'
  ),
  (
    'd1000003-0000-0000-0000-000000000003',
    'a1000002-0000-0000-0000-000000000002',
    '3c33396b-6704-4f1a-8385-f999c4c5acc9',
    '[{"name":"Amlodipine","dosage":"10mg","frequency":"1x/day","durationDays":30},{"name":"Aspirin","dosage":"75mg","frequency":"1x/day","durationDays":30}]',
    'Take Amlodipine in the evening. Monitor blood pressure daily. Reduce salt and fat intake.',
    NOW() - INTERVAL '2 days',
    CURRENT_DATE + INTERVAL '28 days',
    'ON_THE_WAY'
  ),
  (
    'd1000004-0000-0000-0000-000000000004',
    'a1000003-0000-0000-0000-000000000003',
    '8fd84ed8-49c7-4510-9cef-0a1d16627b53',
    '[{"name":"Ambroxol","dosage":"30mg","frequency":"3x/day","durationDays":7},{"name":"Salbutamol inhaler","dosage":"100mcg","frequency":"As needed","durationDays":14}]',
    'Use inhaler only when breathless. Ambroxol helps loosen mucus — take with plenty of water. Avoid cold drinks.',
    NOW() - INTERVAL '3 days',
    CURRENT_DATE + INTERVAL '27 days',
    'PROCESSING'
  ),
  (
    'd1000005-0000-0000-0000-000000000005',
    'a1000004-0000-0000-0000-000000000004',
    '8fd84ed8-49c7-4510-9cef-0a1d16627b53',
    '[{"name":"Metformin","dosage":"1000mg","frequency":"2x/day","durationDays":30},{"name":"Glibenclamide","dosage":"5mg","frequency":"1x/day","durationDays":30}]',
    'Take Metformin with meals to reduce stomach upset. Take Glibenclamide in the morning. Monitor blood sugar daily. Return in 30 days for HbA1c check.',
    NOW() - INTERVAL '1 day',
    CURRENT_DATE + INTERVAL '29 days',
    'PENDING'
  ),
  (
    'd1000006-0000-0000-0000-000000000006',
    'a1000005-0000-0000-0000-000000000005',
    '02d83783-b4bc-4619-a642-ba066c516150',
    '[{"name":"Paracetamol","dosage":"1000mg","frequency":"As needed (max 4x/day)","durationDays":7},{"name":"Ibuprofen","dosage":"400mg","frequency":"2x/day (with food)","durationDays":3}]',
    'Do not take both medications at the same time. Alternate every 4 hours if needed. Avoid ibuprofen on an empty stomach.',
    NOW(),
    CURRENT_DATE + INTERVAL '30 days',
    'PENDING'
  )
ON CONFLICT (prescription_id) DO NOTHING;
