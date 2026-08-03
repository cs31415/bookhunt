-- Delete several library entries at once. Returns how many were removed.
--
-- One statement rather than a loop over fn_remove_from_library: the batch is
-- then atomic without an explicit transaction, and the count comes back from
-- ROW_COUNT rather than being tallied a row at a time.
--
-- The count is what tells "all gone" from "some of those were not yours" --
-- ids belonging to another reader match nothing and simply do not count.
CREATE OR REPLACE FUNCTION fn_remove_many_from_library(
    p_user_id  INT,
    p_book_ids INT[]
) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_removed INT;
BEGIN
    DELETE FROM library_entries
    WHERE user_id = p_user_id AND book_id = ANY(p_book_ids);

    GET DIAGNOSTICS v_removed = ROW_COUNT;

    -- Same reasoning as fn_remove_from_library: the books stay in the catalog,
    -- but this reader's surviving entries must stop pointing at them.
    UPDATE library_entries
    SET user_related = (
        SELECT COALESCE(array_agg(id), '{}')
        FROM unnest(user_related) AS id
        WHERE id <> ALL(p_book_ids)
    )
    WHERE user_id = p_user_id AND user_related && p_book_ids;

    RETURN v_removed;
END;
$$;
