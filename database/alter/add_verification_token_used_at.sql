-- LOS-298: remember that a verification token was spent, rather than deleting it.
--
-- fn_verify_email used to null the token on success, which threw away the only
-- evidence that the link had ever existed. A second click -- the reader opening
-- the email twice, or their mail scanner following the link before they did --
-- was then indistinguishable from a token that never existed, and both were
-- answered "invalid or expired". A real sign-up ended with the reader asking
-- for four resends that could never come and trying to register again, while
-- their account had been working the whole time (LOS-296).
--
-- The token stays in the row, inert: fn_verify_email only accepts one whose
-- used_at IS NULL, so a spent token confirms nothing and mints no session. It
-- is cleared and reissued whenever a fresh token is minted.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. It is idempotent and can be run again safely.
--
-- Reload the functions afterwards, which is where the column is read:
--   psql -d <db> -f database/setup_functions.sql

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verification_token_used_at TIMESTAMPTZ;

-- Rows verified before this column existed carry a null token and a null
-- used_at, so they fall through to the generic answer. Nothing to backfill:
-- their tokens were deleted and cannot be recovered.
