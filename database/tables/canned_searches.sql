-- The catalog of example searches the Discover page draws its pills from.
--
-- Content, not user data: seeded from database/data/canned_searches_seed.sql
-- and edited there, never in place.
CREATE TABLE canned_searches (
    id                  SERIAL PRIMARY KEY,
    query               TEXT UNIQUE NOT NULL,
    category            VARCHAR(64),
    is_active           BOOLEAN DEFAULT TRUE,
    -- NULL for the curated catalog; set when a reader saved their own typed
    -- search as a pill. Only catalog rows are ever drawn as suggestions, so one
    -- reader's phrasing never turns up in another reader's row -- a saved
    -- search is reachable only through the pin that created it.
    created_by_user_id  INT REFERENCES users(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- UNIQUE on the text so the seed can re-run with ON CONFLICT DO NOTHING.
-- Reseeding after adding rows must not duplicate anything or hand an existing
-- query a new id: user_pinned_searches points at these ids, so a renumbering
-- would silently repoint every pin in the database at some other search.

-- Partial: every read of this table filters on is_active, and the retired rows
-- are the small minority we never want back. Retiring beats deleting because a
-- delete cascades away the pins of everyone who liked it.
CREATE INDEX idx_canned_searches_active ON canned_searches(is_active) WHERE is_active;
