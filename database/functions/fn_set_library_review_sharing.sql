-- Publish, hold back, or defer one review (LOS-266).
--
-- Three states in one nullable column: TRUE always shows it, FALSE always hides
-- it, and NULL inherits users.share_reviews. That is why this **always
-- assigns** rather than COALESCEing -- it has to be able to write NULL, and
-- under the COALESCE pattern NULL is how a caller says "leave this alone".
--
-- The same lesson fn_set_library_favorite came from in LOS-249, one step
-- further: there the problem was a boolean that could be turned on and never
-- off, here it is a tri-state whose middle value is the pattern's own sentinel.
-- A parameter on fn_update_library_entry could not express "back to default" at
-- all.
--
-- Returns no rows when the reader does not own the book, which the controller
-- reads as a 404. The WHERE on user_id is the ownership check; there is no
-- separate lookup to get out of step with it.
CREATE OR REPLACE FUNCTION fn_set_library_review_sharing(
    p_user_id INT,
    p_book_id INT,
    -- NULL is a value here, not an absence: it means "follow the global
    -- setting from now on".
    p_share   BOOLEAN
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    share_review BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE library_entries le
    SET share_review = p_share
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.share_review;
END;
$$;
