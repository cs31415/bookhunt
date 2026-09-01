-- LOS-376: put registration behind a code.
--
-- Registration was open, and LOS-363 established that 64 of the 66 accounts it
-- produced were bots -- each one followed by a password-reset request, so the
-- server was being used to mail roughly sixty harvested addresses.
--
-- Rate limiting was never the gap. /register allows 10/hour and the bot ran at
-- 2-3/hour, deliberately under it. This is categorical instead: no code, no
-- account, and therefore no email.
--
-- This repo has no migration tool, so nothing tracks whether this has run. It
-- is idempotent and can be run again safely.
--
-- Reload the functions afterwards -- fn_register_user changes signature here:
--   psql -d <db> -f database/setup_functions.sql

CREATE TABLE IF NOT EXISTS invite_codes (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(64) NOT NULL,
    note            VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    used_at         TIMESTAMPTZ,
    used_by_user_id INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_code_lower ON invite_codes (LOWER(code));

-- Separate, so a database that already ran the first version of this script
-- picks up the column too.
ALTER TABLE invite_codes
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
