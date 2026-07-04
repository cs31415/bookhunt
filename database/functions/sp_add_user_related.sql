-- Append a related book to the user_related array on a library entry.
-- Rejects if p_related_book_id = p_book_id.
-- Only appends if not already present. Returns the updated array.
CREATE OR REPLACE FUNCTION sp_add_user_related(
    p_user_id        INT,
    p_book_id        INT,
    p_related_book_id INT
) RETURNS INT[]
LANGUAGE plpgsql AS $$
DECLARE
    v_result INT[];
BEGIN
    IF p_related_book_id = p_book_id THEN
        RAISE EXCEPTION 'A book cannot be related to itself';
    END IF;

    UPDATE library_entries
    SET user_related = CASE
        WHEN NOT (p_related_book_id = ANY(COALESCE(user_related, '{}')))
            THEN array_append(COALESCE(user_related, '{}'), p_related_book_id)
        ELSE user_related
    END
    WHERE user_id = p_user_id AND book_id = p_book_id
    RETURNING user_related INTO v_result;

    RETURN v_result;
END;
$$;
