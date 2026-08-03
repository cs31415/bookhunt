-- Delete a library entry. Return boolean via FOUND.
CREATE OR REPLACE FUNCTION fn_remove_from_library(
    p_user_id INT,
    p_book_id INT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_removed BOOLEAN;
BEGIN
    DELETE FROM library_entries
    WHERE user_id = p_user_id AND book_id = p_book_id;

    -- Read FOUND before the UPDATE below overwrites it.
    v_removed := FOUND;

    -- The book stays in the catalog, so nothing dangles in the foreign-key
    -- sense -- but this reader's other entries may still list it as related,
    -- and the detail page would go on offering a book they no longer own.
    UPDATE library_entries
    SET user_related = array_remove(user_related, p_book_id)
    WHERE user_id = p_user_id AND p_book_id = ANY(user_related);

    RETURN v_removed;
END;
$$;
