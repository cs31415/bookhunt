-- Remove a related book from the user_related array. Returns the updated array.
CREATE OR REPLACE FUNCTION sp_remove_user_related(
    p_user_id        INT,
    p_book_id        INT,
    p_related_book_id INT
) RETURNS INT[]
LANGUAGE plpgsql AS $$
DECLARE
    v_result INT[];
BEGIN
    UPDATE library_entries
    SET user_related = array_remove(COALESCE(user_related, '{}'), p_related_book_id)
    WHERE user_id = p_user_id AND book_id = p_book_id
    RETURNING user_related INTO v_result;

    RETURN v_result;
END;
$$;
