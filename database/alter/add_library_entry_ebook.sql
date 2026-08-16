-- LOS-271: per-book format flag.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. Everything here is idempotent and can be run again safely.
--
-- NOT NULL DEFAULT FALSE rather than nullable: every entry that predates the
-- column is a physical book, so the backfill and the default are the same
-- value and there is no third state to interpret.
--
-- No index. Format is a two-value split of a query that is already narrowed to
-- one user, which idx_library_user_id serves; a partial index the size of half
-- the table would only cost writes.
--
-- Reload the functions afterwards:
--   psql -d <db> -f database/setup_functions.sql

ALTER TABLE library_entries
    ADD COLUMN IF NOT EXISTS is_ebook BOOLEAN NOT NULL DEFAULT FALSE;
