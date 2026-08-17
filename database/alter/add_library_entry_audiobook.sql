-- LOS-273: the second half of the format pair.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. Everything here is idempotent and can be run again safely.
--
-- A second boolean rather than turning is_ebook into a three-way enum.
-- library_entries is one row per (reader, book), and owning both the Kindle and
-- the Audible copy of one book is ordinary -- an enum would force a lie. So the
-- two are independent, and "physical" is the absence of both.
--
-- Reload the functions afterwards:
--   psql -d <db> -f database/setup_functions.sql

ALTER TABLE library_entries
    ADD COLUMN IF NOT EXISTS is_audiobook BOOLEAN NOT NULL DEFAULT FALSE;
