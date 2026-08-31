-- Update only the fields that are not NULL (COALESCE with existing values).
-- If status changes to 'finished', set date_read = NOW().
-- Returns nothing if entry does not exist.
-- Both the parameter list and the row type lose `notes`, folded into `review`
-- by LOS-266. Either change alone would need this: a new parameter list makes
-- CREATE OR REPLACE define an overload rather than replace, and a changed
-- RETURNS TABLE it cannot do at all.
DROP FUNCTION IF EXISTS fn_update_library_entry(INT, INT, reading_status, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION fn_update_library_entry(
    p_user_id     INT,
    p_book_id     INT,
    p_status      reading_status DEFAULT NULL,
    p_user_rating INT DEFAULT NULL,
    p_review      TEXT DEFAULT NULL
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    user_related INT[]
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE library_entries le
    SET status      = COALESCE(p_status, le.status),
        user_rating = COALESCE(p_user_rating, le.user_rating),
        review      = COALESCE(p_review, le.review),
        date_read   = CASE
                        WHEN p_status = 'finished' AND le.status <> 'finished'
                            THEN NOW()
                        ELSE le.date_read
                      END
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.status, le.date_added, le.date_read,
              le.user_rating, le.review, le.user_related;
END;
$$;
