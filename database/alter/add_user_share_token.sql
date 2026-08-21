-- LOS-305: a second address for a profile, carrying a random token.
--
-- Borrows the unlisted-video idea. A profile was either discoverable or it was
-- not, and the public page lived at the reader's handle -- a guessable address.
-- There was no way to show a shelf to one person without putting it where
-- anyone could find it.
--
-- The column is the whole of the new state. Three states now, inferred rather
-- than stored twice:
--
--   share_token IS NULL, is_discoverable false  -> private
--   share_token set,     is_discoverable false  -> unlisted
--   is_discoverable true                        -> discoverable
--
-- NULL by default, so no reader has a link until they ask for one. Deleting the
-- token is how a reader goes back to private; writing a fresh one is how they
-- take back a link that has spread.
--
-- UNIQUE because the token is the whole credential: two accounts sharing one
-- would make the address ambiguous. The index is also what the lookup reads,
-- and it has to be fast -- it is on the path of every visit to a shared page.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. It is idempotent and can be run again safely.
--
-- Reload the functions afterwards, which is where the token is read:
--   psql -d <db> -f database/setup_functions.sql

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_token ON users (share_token);
