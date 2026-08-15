-- Find readers by handle or display name, for the @ search.
--
-- Restricted to is_discoverable: a reader who has not published their page is
-- not findable, or the search would be a way to enumerate accounts that have
-- deliberately stayed private.
--
-- Exact-prefix matches first, because someone typing "@ada" wants @ada before
-- @adamantine.
CREATE OR REPLACE FUNCTION fn_search_users(
    p_query VARCHAR,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    handle       VARCHAR,
    display_name VARCHAR,
    book_count   BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.handle,
        u.display_name,
        COUNT(le.book_id) AS book_count
    FROM users u
    LEFT JOIN library_entries le
           ON le.user_id = u.id
          AND NOT le.is_hidden
    WHERE u.is_discoverable
      AND (u.handle ILIKE p_query || '%' OR u.display_name ILIKE '%' || p_query || '%')
    GROUP BY u.handle, u.display_name
    ORDER BY
        -- A handle that starts with the query outranks a name that merely
        -- contains it.
        CASE WHEN u.handle ILIKE p_query || '%' THEN 0 ELSE 1 END,
        LENGTH(u.handle),
        u.handle
    LIMIT p_limit;
END;
$$;
