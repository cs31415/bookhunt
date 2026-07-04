-- Update genres and themes on a book row.
CREATE OR REPLACE FUNCTION fn_update_book_ai_metadata(
    p_book_id INT,
    p_genres  TEXT[],
    p_themes  TEXT[]
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE books
    SET genres = COALESCE(p_genres, '{}'),
        themes = COALESCE(p_themes, '{}')
    WHERE id = p_book_id;
END;
$$;
