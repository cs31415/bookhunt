-- Every row of suggestions a signed-in reader has been shown, newest last.
--
-- Backs the < > arrows on the Discover pills: a reader who refreshes past
-- something interesting can walk back to it instead of refreshing hopefully
-- until it comes round again (LOS-212).
--
-- Guests get the same arrows, but their history lives in component state and
-- dies with the tab -- there is no user to hang it on.
CREATE TABLE canned_search_draws (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The suggestions as drawn, in display order. Deliberately not a join
    -- table: a draw is an immutable event, always read whole and never queried
    -- by which searches it contained.
    search_ids INT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches the only query: this reader's recent draws, newest first.
CREATE INDEX idx_canned_search_draws_user ON canned_search_draws(user_id, created_at DESC);
