-- Insert a library entry. ON CONFLICT DO NOTHING to avoid duplicates.
-- Returns the entry row (existing or newly created).
--
-- The format flags arrive here rather than through a follow-up call because an
-- import knows them at add time: a Goodreads export says "Kindle Edition" in
-- the same row as the title, and a second request per book would double the
-- cost of a 300-row import.
--
-- DROP is required, not tidy. Leaving the old three-argument signature in place
-- beside a five-argument one with defaults makes fn_add_to_library(1, 2,
-- 'queued') ambiguous, and Postgres refuses the call outright.
DROP FUNCTION IF EXISTS fn_add_to_library(INT, INT, reading_status);
CREATE OR REPLACE FUNCTION fn_add_to_library(
    p_user_id      INT,
    p_book_id      INT,
    p_status       reading_status DEFAULT 'queued',
    p_is_ebook     BOOLEAN DEFAULT FALSE,
    p_is_audiobook BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    notes        TEXT,
    user_related INT[]
)
LANGUAGE plpgsql AS $$
BEGIN
    -- DO NOTHING still: re-adding a book the reader already owns must not
    -- rewrite the flags they have since set by hand.
    INSERT INTO library_entries (user_id, book_id, status, is_ebook, is_audiobook)
    VALUES (p_user_id, p_book_id, p_status, p_is_ebook, p_is_audiobook)
    ON CONFLICT ON CONSTRAINT library_entries_pkey DO NOTHING;

    RETURN QUERY
    SELECT le.user_id, le.book_id, le.status, le.date_added, le.date_read,
           le.user_rating, le.review, le.notes, le.user_related
    FROM library_entries le
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id;
END;
$$;
