-- Update only the fields that are not NULL (COALESCE with existing values).
-- If status changes to 'finished', set date_read = NOW().
-- Returns nothing if entry does not exist.
CREATE OR REPLACE FUNCTION sp_update_library_entry(
    p_user_id     INT,
    p_book_id     INT,
    p_status      reading_status DEFAULT NULL,
    p_user_rating INT DEFAULT NULL,
    p_notes       TEXT DEFAULT NULL,
    p_review      TEXT DEFAULT NULL
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
    RETURN QUERY
    UPDATE library_entries le
    SET status      = COALESCE(p_status, le.status),
        user_rating = COALESCE(p_user_rating, le.user_rating),
        notes       = COALESCE(p_notes, le.notes),
        review      = COALESCE(p_review, le.review),
        date_read   = CASE
                        WHEN p_status = 'finished' AND le.status <> 'finished'
                            THEN NOW()
                        ELSE le.date_read
                      END
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.status, le.date_added, le.date_read,
              le.user_rating, le.review, le.notes, le.user_related;
END;
$$;
