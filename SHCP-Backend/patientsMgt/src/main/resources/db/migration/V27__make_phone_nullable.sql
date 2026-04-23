-- Google OAuth users do not have a phone number at sign-up time.
-- Make the column nullable so Google accounts can be created without one.
-- Existing rows are unaffected (they already have a value).
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
