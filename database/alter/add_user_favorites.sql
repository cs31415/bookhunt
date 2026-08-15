-- LOS-254: readers favouriting other readers.
--
-- This repo has no migration tool, so there is nothing tracking whether this
-- has already run. Everything here is idempotent and can be run again safely.
--
-- Reload the functions afterwards:
--   psql -d <db> -f database/setup_functions.sql

CREATE TABLE IF NOT EXISTS user_favorites (
    user_id          INT REFERENCES users(id) ON DELETE CASCADE,
    favorite_user_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, favorite_user_id),
    CHECK (user_id <> favorite_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_reverse ON user_favorites(favorite_user_id);
