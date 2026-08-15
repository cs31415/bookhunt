-- LOS-255. Idempotent; reload functions afterwards.
-- Authors a reader has favourited.
--
-- Its own table because authors is a shared global catalogue with no per-user
-- join table -- unlike library_entries, there is nowhere to hang a flag.
--
-- Public, like favourite books: an author list reads as taste, not as a social
-- graph, so it is shown on a public profile. Favourite readers are not.
CREATE TABLE IF NOT EXISTS user_favorite_authors (
    user_id    INT REFERENCES users(id) ON DELETE CASCADE,
    author_id  INT REFERENCES authors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_authors_author ON user_favorite_authors(author_id);
