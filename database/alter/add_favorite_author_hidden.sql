-- LOS-282: keep an individual favourite author off the public page.
--
-- The counterpart to library_entries.is_hidden (LOS-249). Books could already
-- be excluded one at a time; a favourite author was all-or-nothing, so the only
-- way to hide one was to stop favouriting them -- which changes what the reader
-- sees as well as what a visitor sees.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. It is idempotent and can be run again safely.
--
-- Reload the functions afterwards, which is where the flag is read:
--   psql -d <db> -f database/setup_functions.sql

ALTER TABLE user_favorite_authors
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
