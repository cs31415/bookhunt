-- Hide or unhide one owned book on the reader's public profile.
--
-- Separate from fn_update_library_entry for the same reason as
-- fn_set_library_favorite: a COALESCE-based update cannot express "set this
-- boolean to false".
--
-- The flag gates only the public read path. The owner's own library shows
-- hidden books as usual, with a badge, so what is excluded stays legible.
--
-- Returns no rows when the user does not own the book, which the controller
-- reads as a 404.
CREATE OR REPLACE FUNCTION fn_set_library_visibility(
    p_user_id   INT,
    p_book_id   INT,
    p_is_hidden BOOLEAN
) RETURNS TABLE (
    user_id     INT,
    book_id     INT,
    is_favorite BOOLEAN,
    is_hidden   BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE library_entries le
    SET is_hidden = p_is_hidden
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.is_favorite, le.is_hidden;
END;
$$;
