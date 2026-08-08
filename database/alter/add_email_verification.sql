-- One-off migration for a database that predates LOS-218 and cannot simply be
-- dropped. A development database does not need this: `npm run db:reset` builds
-- the columns and the index straight from tables/users.sql.
--
-- Run with: psql -d <database> -f database/alter/add_email_verification.sql
-- Then reload the stored functions: psql -d <database> -f database/setup_functions.sql
--
-- This repo has no migration tool, so there is nothing tracking whether this has
-- already run. It is written to be safe to run twice.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified_at             TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_token            VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

-- Canonicalise before the unique index goes on, because the index is what
-- enforces the rule from here on. If two rows differ only by case this aborts
-- the whole migration, which is the right outcome: deciding which of two real
-- accounts survives, and what happens to the library entries hanging off the
-- loser, is not a decision a migration script gets to make.
UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- Everyone who could sign in before this shipped can still sign in after it.
-- Only accounts created from now on have to prove their address.
UPDATE users
SET email_verified_at = created_at
WHERE email_verified_at IS NULL;

COMMIT;
