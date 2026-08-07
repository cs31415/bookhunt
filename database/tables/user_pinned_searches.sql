-- Canned searches a reader has pinned to the top of their Discover pills.
--
-- Its own table rather than a blob in users.preferences: the FK keeps a pin
-- from outliving the search it points at, and "which canned searches do people
-- actually pin" stays a one-line query instead of a JSONB unnest (LOS-212).
CREATE TABLE user_pinned_searches (
    user_id          INT REFERENCES users(id) ON DELETE CASCADE,
    canned_search_id INT REFERENCES canned_searches(id) ON DELETE CASCADE,
    position         INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, canned_search_id)
);

-- The only access path: every pin for one reader, ordered. The PK's leading
-- column would serve, but this stays honest if the PK order ever changes.
CREATE INDEX idx_user_pinned_searches_user ON user_pinned_searches(user_id);
