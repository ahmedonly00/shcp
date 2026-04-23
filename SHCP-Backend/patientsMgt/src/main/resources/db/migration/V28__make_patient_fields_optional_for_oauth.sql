-- V28 — Allow Google OAuth patients without date_of_birth and national_id
-- Google sign-in creates a Patient row automatically but the OAuth provider
-- does not supply date of birth or national ID at sign-up time.
-- Manual (email) registration still validates both fields in the application layer.
ALTER TABLE patients ALTER COLUMN date_of_birth DROP NOT NULL;
ALTER TABLE patients ALTER COLUMN national_id    DROP NOT NULL;
