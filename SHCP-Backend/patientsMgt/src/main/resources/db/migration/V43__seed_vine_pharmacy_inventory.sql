-- V43 — Seed 10 medications for Vine Pharmacy (7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6)
INSERT INTO pharmacy_inventory (
    inventory_id, pharmacy_id,
    medication_name, generic_name,
    quantity_in_stock, unit,
    expiry_date, reorder_level,
    created_at, updated_at
) VALUES
('f0000000-0000-0000-0000-000000000051','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Amoxicillin 500mg','amoxicillin',130,'capsules','2027-06-30',20,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000052','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Artemether-Lumefantrine 20/120mg','artemether-lumefantrine',60,'tablets','2027-03-31',15,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000053','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Paracetamol 500mg','paracetamol',450,'tablets','2027-12-31',50,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000054','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Ibuprofen 400mg','ibuprofen',11,'tablets','2027-09-30',30,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000055','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Metformin 500mg','metformin',95,'tablets','2027-08-31',20,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000056','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Amlodipine 5mg','amlodipine',40,'tablets','2027-11-30',15,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000057','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Omeprazole 20mg','omeprazole',7,'capsules','2026-12-31',10,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000058','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Loratadine 10mg','loratadine',55,'tablets','2027-04-30',10,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000059','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Azithromycin 250mg','azithromycin',3,'tablets','2027-02-28',15,NOW(),NOW()),
('f0000000-0000-0000-0000-000000000060','7ac8946b-ac2a-4fe9-a6d9-651ffe774ba6','Fluconazole 150mg','fluconazole',28,'capsules','2027-07-31',5,NOW(),NOW())
ON CONFLICT (pharmacy_id, medication_name) DO NOTHING;
