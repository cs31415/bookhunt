-- Mark one owned book as an audiobook, or back.
--
-- Separate from fn_update_library_entry for the same reason as its three
-- siblings: that function is COALESCE-based, where NULL means "leave this
-- alone", so it cannot express setting a boolean to false.
--
-- Independent of is_ebook. Setting one does not clear the other, because a
-- reader can own both the Kindle and the Audible copy of the same book.
--
-- Returns no rows when the user does not own the book, which the controller
-- reads as a 404.
CREATE OR REPLACE FUNCTION fn_set_library_audiobook(
    p_user_id      INT,
    p_book_id      INT,
    p_is_audiobook BOOLEAN
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    is_favorite  BOOLEAN,
    is_hidden    BOOLEAN,
    is_ebook     BOOLEAN,
    is_audiobook BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE library_entries le
    SET is_audiobook = p_is_audiobook
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.is_favorite, le.is_hidden,
              le.is_ebook, le.is_audiobook;
END;
$$;
