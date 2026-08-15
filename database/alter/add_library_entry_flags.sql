-- LOS-249: per-book favourite and public-visibility flags.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. Everything here is idempotent and can be run again safely.
--
-- Both columns arrive together on purpose. fn_get_user_library and
-- fn_search_library share a column list deliberately, so the frontend
-- normalizer can treat them interchangeably, and every added column means
-- dropping and recreating both. Once is enough.
--
-- Reload the functions afterwards:
--   psql -d <db> -f database/setup_functions.sql

ALTER TABLE library_entries
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE library_entries
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_library_favorites
    ON library_entries(user_id) WHERE is_favorite;
