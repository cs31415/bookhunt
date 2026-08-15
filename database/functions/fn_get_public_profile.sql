-- The header of a public profile: who this is, and how much is on the shelf.
--
-- Returns no rows for an unknown handle AND for one whose page is off. The
-- caller cannot tell those apart, and must not be able to: a different answer
-- for each would turn this into an oracle for which handles are taken.
--
-- Counts respect the same exclusions the library does, so the number over the
-- grid matches what is in it.
CREATE OR REPLACE FUNCTION fn_get_public_profile(
    p_handle VARCHAR
)
RETURNS TABLE (
    handle          VARCHAR,
    display_name    VARCHAR,
    created_at      TIMESTAMPTZ,
    total_books     BIGINT,
    reading_count   BIGINT,
    finished_count  BIGINT,
    favorite_count  BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.handle,
        u.display_name,
        u.created_at,
        COUNT(le.book_id)                                                    AS total_books,
        COUNT(*) FILTER (WHERE le.status = 'reading')                        AS reading_count,
        COUNT(*) FILTER (WHERE le.status = 'finished')                       AS finished_count,
        COUNT(*) FILTER (WHERE le.is_favorite)                               AS favorite_count
    FROM users u
    -- LEFT so a reader with a public page and an empty shelf still has a
    -- profile; the counts come back as zero rather than the profile vanishing.
    LEFT JOIN library_entries le
           ON le.user_id = u.id
          AND NOT le.is_hidden
    WHERE LOWER(u.handle) = LOWER(p_handle)
      AND u.is_discoverable
    GROUP BY u.handle, u.display_name, u.created_at;
END;
$$;
