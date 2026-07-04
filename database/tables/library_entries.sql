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
    PRIMARY KEY (user_id, book_id)
);

CREATE INDEX idx_library_user_id ON library_entries(user_id);
CREATE INDEX idx_library_book_id ON library_entries(book_id);
