-- Insert a library entry. ON CONFLICT DO NOTHING to avoid duplicates.
-- Returns the entry row (existing or newly created).
CREATE OR REPLACE FUNCTION sp_add_to_library(
    p_user_id INT,
    p_book_id INT,
    p_status  reading_status DEFAULT 'queued'
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
    INSERT INTO library_entries (user_id, book_id, status)
    VALUES (p_user_id, p_book_id, p_status)
    ON CONFLICT ON CONSTRAINT library_entries_pkey DO NOTHING;

    RETURN QUERY
    SELECT le.user_id, le.book_id, le.status, le.date_added, le.date_read,
           le.user_rating, le.review, le.notes, le.user_related
    FROM library_entries le
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id;
END;
$$;
