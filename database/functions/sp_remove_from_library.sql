-- Delete a library entry. Return boolean via FOUND.
CREATE OR REPLACE FUNCTION sp_remove_from_library(
    p_user_id INT,
    p_book_id INT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM library_entries
    WHERE user_id = p_user_id AND book_id = p_book_id;

    RETURN FOUND;
END;
$$;
