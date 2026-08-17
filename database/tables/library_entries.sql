CREATE TABLE library_entries (
    user_id      INT REFERENCES users(id) ON DELETE CASCADE,
    book_id      INT REFERENCES books(id),
    status       reading_status DEFAULT 'queued',
    date_added   TIMESTAMPTZ DEFAULT NOW(),
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    notes        TEXT,
    user_related INT[] DEFAULT '{}',
    -- Set through fn_set_library_favorite, not fn_update_library_entry: that
    -- function is COALESCE-based, where NULL means unchanged, so a boolean
    -- routed through it could never be turned back off.
    is_favorite  BOOLEAN NOT NULL DEFAULT FALSE,
    -- Excluded from the public profile at bookhunt.net/<handle>. Has no effect
    -- on what the owner sees in their own library.
    is_hidden    BOOLEAN NOT NULL DEFAULT FALSE,
    -- The copy the reader owns is an ebook. FALSE means a physical book, which
    -- is why the column is NOT NULL: every shelf predating it is physical.
    --
    -- Independent of is_audiobook rather than two values of one enum: owning
    -- both the Kindle and the Audible copy of a book is ordinary, and this is
    -- one row per (reader, book). Neither set means physical.
    is_ebook     BOOLEAN NOT NULL DEFAULT FALSE,
    is_audiobook BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, book_id)
);

CREATE INDEX idx_library_user_id ON library_entries(user_id);
CREATE INDEX idx_library_book_id ON library_entries(book_id);
-- Partial: favourites are a small slice of any shelf, and the Favourites tab
-- always asks for one user's.
CREATE INDEX idx_library_favorites ON library_entries(user_id) WHERE is_favorite;
