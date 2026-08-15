-- Set or clear the favourite flag on one owned book.
--
-- Separate from fn_update_library_entry rather than another parameter on it.
-- That function is COALESCE-based, where NULL means "leave this alone", so a
-- boolean passed through it could be turned on and never off again -- the one
-- value it needs to carry is indistinguishable from "unchanged".
--
-- Returns no rows when the user does not own the book, which the controller
-- reads as a 404. The WHERE on user_id is the ownership check; there is no
-- separate lookup to get out of step with it.
CREATE OR REPLACE FUNCTION fn_set_library_favorite(
    p_user_id     INT,
    p_book_id     INT,
    p_is_favorite BOOLEAN
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
    SET is_favorite = p_is_favorite
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.is_favorite, le.is_hidden;
END;
$$;
