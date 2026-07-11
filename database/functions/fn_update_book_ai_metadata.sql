-- Update genres, themes, and moods on a book row.
DROP FUNCTION IF EXISTS fn_update_book_ai_metadata(INT, TEXT[], TEXT[]);

CREATE OR REPLACE FUNCTION fn_update_book_ai_metadata(
    p_book_id INT,
    p_genres  TEXT[],
    p_themes  TEXT[],
    p_moods   TEXT[]
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE books
    SET genres = COALESCE(p_genres, '{}'),
        themes = COALESCE(p_themes, '{}'),
        moods = COALESCE(p_moods, '{}')
    WHERE id = p_book_id;
END;
$$;
