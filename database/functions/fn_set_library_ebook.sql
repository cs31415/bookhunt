-- Mark one owned book as an ebook, or back to a physical copy.
--
-- Separate from fn_update_library_entry for the same reason as
-- fn_set_library_favorite and fn_set_library_visibility: that function is
-- COALESCE-based, where NULL means "leave this alone", so it cannot express
-- setting a boolean to false.
--
-- Returns no rows when the user does not own the book, which the controller
-- reads as a 404. The WHERE on user_id is the ownership check; there is no
-- separate lookup to get out of step with it.
CREATE OR REPLACE FUNCTION fn_set_library_ebook(
    p_user_id  INT,
    p_book_id  INT,
    p_is_ebook BOOLEAN
) RETURNS TABLE (
    user_id     INT,
    book_id     INT,
    is_favorite BOOLEAN,
    is_hidden   BOOLEAN,
    is_ebook    BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE library_entries le
    SET is_ebook = p_is_ebook
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.is_favorite, le.is_hidden, le.is_ebook;
END;
$$;
