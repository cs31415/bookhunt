-- LOS-342: the filter values a shelf actually offers.
--
-- Separate from fn_get_public_library because it answers a different question.
-- That function returns a *page*; this returns the distinct values across the
-- whole shelf. A caller holding one page of 24 cannot derive them -- it would
-- offer whichever categories happened to land on that page, and they would
-- change underneath the reader as they paged. The owner's own library escapes
-- this only because the client happens to hold every entry.
--
-- Ordered by how many books carry each value, then alphabetically, so ties are
-- stable rather than arbitrary.

-- The shelf's own facets, by user. The two public entry points below differ
-- only in how they decide which user, and whether that user's shelf may be
-- read at all -- so the counting lives here once.
DROP FUNCTION IF EXISTS fn_shelf_facets(INT, INT);
CREATE OR REPLACE FUNCTION fn_shelf_facets(
    p_user_id INT,
    p_limit   INT DEFAULT 12
) RETURNS TABLE (
    facet  TEXT,
    value  TEXT,
    books  BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH shelf AS (
        -- NOT is_hidden here, not in the callers: a facet list computed over
        -- hidden books would leak their categories, which is the shape of leak
        -- fn_get_public_library's row type exists to make impossible.
        SELECT b.subjects, b.moods, b.themes, le.status
        FROM library_entries le
        JOIN books b ON b.id = le.book_id
        WHERE le.user_id = p_user_id
          AND NOT le.is_hidden
    ),
    counted AS (
        SELECT 'subject' AS f, x AS v, COUNT(*) AS n
        FROM shelf, unnest(shelf.subjects) x GROUP BY x
        UNION ALL
        SELECT 'mood', x, COUNT(*) FROM shelf, unnest(shelf.moods) x GROUP BY x
        UNION ALL
        SELECT 'theme', x, COUNT(*) FROM shelf, unnest(shelf.themes) x GROUP BY x
        UNION ALL
        SELECT 'status', shelf.status::TEXT, COUNT(*) FROM shelf GROUP BY shelf.status
    ),
    ranked AS (
        SELECT c.f, c.v, c.n,
               ROW_NUMBER() OVER (PARTITION BY c.f ORDER BY c.n DESC, c.v ASC) AS rank
        FROM counted c
    )
    SELECT r.f::TEXT, r.v::TEXT, r.n::BIGINT
    FROM ranked r
    WHERE r.rank <= p_limit
    ORDER BY r.f, r.n DESC, r.v ASC;
END;
$$;

-- By handle: the public profile. Returns nothing for a handle that is not
-- discoverable, matching fn_get_public_library rather than trusting the caller.
DROP FUNCTION IF EXISTS fn_get_public_library_facets(VARCHAR, INT);
CREATE OR REPLACE FUNCTION fn_get_public_library_facets(
    p_handle VARCHAR,
    p_limit  INT DEFAULT 12
) RETURNS TABLE (
    facet  TEXT,
    value  TEXT,
    books  BIGINT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id INT;
BEGIN
    SELECT u.id INTO v_user_id
    FROM users u
    WHERE LOWER(u.handle) = LOWER(p_handle) AND u.is_discoverable;

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY SELECT * FROM fn_shelf_facets(v_user_id, p_limit);
END;
$$;

-- By share token: the unlisted profile. No is_discoverable gate -- the token is
-- the permission -- but an empty token must not match a user whose token is
-- NULL, the same guard fn_get_library_by_token makes.
DROP FUNCTION IF EXISTS fn_get_library_facets_by_token(VARCHAR, INT);
CREATE OR REPLACE FUNCTION fn_get_library_facets_by_token(
    p_token VARCHAR,
    p_limit INT DEFAULT 12
) RETURNS TABLE (
    facet  TEXT,
    value  TEXT,
    books  BIGINT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id INT;
BEGIN
    IF p_token IS NULL OR p_token = '' THEN
        RETURN;
    END IF;

    SELECT u.id INTO v_user_id FROM users u WHERE u.share_token = p_token;

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY SELECT * FROM fn_shelf_facets(v_user_id, p_limit);
END;
$$;
