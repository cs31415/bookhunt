-- Replace one book's cover URL (LOS-272).
--
-- Deliberately not fn_enrich_thin_book. That one is COALESCE-based by design --
-- it fills blanks and keeps whatever the row already had -- so it can never
-- overwrite the dead URL this exists to replace.
--
-- Returns TRUE when a row was updated, FALSE when no book has that id.
CREATE OR REPLACE FUNCTION fn_set_book_cover(
    p_book_id   INT,
    p_cover_url VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_updated INT;
BEGIN
    UPDATE books SET cover_url = p_cover_url WHERE id = p_book_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated > 0;
END;
$$;
