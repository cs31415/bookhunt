-- The unlisted address: a profile reachable by anyone holding a random token,
-- and listed nowhere (LOS-305).
--
-- These are deliberately near-copies of fn_get_public_profile and
-- fn_get_public_library, differing in exactly two ways, and both differences
-- are the point:
--
--   1. The lookup is by share_token, not by handle.
--   2. There is no is_discoverable gate. An unlisted page works while the
--      reader's public page is off -- that is what "unlisted" means.
--
-- What does NOT change is `NOT le.is_hidden`. Unlisted means "not listed", not
-- "everything on show", so the per-book ticks a reader has set still hold. A
-- copy that quietly dropped that clause would publish books they had chosen to
-- withhold, which is the one mistake this feature must not make.
--
-- A NULL or empty token matches nothing. That guard is in the WHERE rather than
-- in a caller, so no future route can forget it and have every reader whose
-- share_token is NULL match at once.

-- Writes a token, or NULL to revoke. Regenerating is the same call with a fresh
-- value, which is what kills a link that has spread. Returns the token now
-- stored, so the caller reports what happened rather than what it asked for.
CREATE OR REPLACE FUNCTION fn_set_share_token(
    p_user_id INT,
    p_token   VARCHAR
) RETURNS VARCHAR
LANGUAGE plpgsql AS $$
DECLARE
    stored VARCHAR;
BEGIN
    UPDATE users
       SET share_token = p_token
     WHERE id = p_user_id
    RETURNING share_token INTO stored;

    RETURN stored;
END;
$$;

-- The token a reader currently holds, or NULL if they have none.
CREATE OR REPLACE FUNCTION fn_get_share_token(
    p_user_id INT
) RETURNS VARCHAR
LANGUAGE plpgsql AS $$
DECLARE
    stored VARCHAR;
BEGIN
    SELECT u.share_token INTO stored FROM users u WHERE u.id = p_user_id;
    RETURN stored;
END;
$$;

-- The header of a shared profile. No rows for an unknown token, which the
-- caller reads as a 404 -- the same answer an unknown handle gets, so a
-- guessed token cannot be told from a revoked one.
CREATE OR REPLACE FUNCTION fn_get_profile_by_token(
    p_token VARCHAR
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
    IF p_token IS NULL OR p_token = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        u.handle,
        u.display_name,
        u.created_at,
        COUNT(le.book_id)                              AS total_books,
        COUNT(*) FILTER (WHERE le.status = 'reading')  AS reading_count,
        COUNT(*) FILTER (WHERE le.status = 'finished') AS finished_count,
        COUNT(*) FILTER (WHERE le.is_favorite)         AS favorite_count
    FROM users u
    -- LEFT, as on the public profile, so a shared page with an empty shelf is
    -- still a page rather than a 404.
    LEFT JOIN library_entries le
           ON le.user_id = u.id
          AND NOT le.is_hidden
    WHERE u.share_token = p_token
    GROUP BY u.handle, u.display_name, u.created_at;
END;
$$;

-- The shelf of a shared profile. Carries the same filters the public library
-- grew in LOS-304, so a shared page searches and filters exactly as the public
-- one does rather than being a lesser copy of it.
CREATE OR REPLACE FUNCTION fn_get_library_by_token(
    p_token          VARCHAR,
    p_status         reading_status DEFAULT NULL,
    p_favorites_only BOOLEAN        DEFAULT FALSE,
    p_limit          INT            DEFAULT 24,
    p_offset         INT            DEFAULT 0,
    p_query          TEXT           DEFAULT NULL,
    p_subject        TEXT           DEFAULT NULL
) RETURNS TABLE (
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    is_favorite  BOOLEAN,
    title        VARCHAR,
    book_slug    VARCHAR,
    author_name  VARCHAR,
    author_slug  VARCHAR,
    year         INT,
    pages        INT,
    rating       NUMERIC,
    subjects     TEXT[],
    moods        TEXT[],
    themes       TEXT[],
    cover_url    VARCHAR,
    hue          VARCHAR,
    total_count  BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF p_token IS NULL OR p_token = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        le.book_id,
        le.status,
        le.date_added,
        le.date_read,
        le.user_rating,
        le.is_favorite,
        b.title,
        b.slug    AS book_slug,
        a.name    AS author_name,
        a.slug    AS author_slug,
        b.year,
        b.pages,
        b.rating,
        b.subjects,
        b.moods,
        b.themes,
        b.cover_url,
        b.hue,
        COUNT(*) OVER ()::BIGINT AS total_count
    FROM library_entries le
    JOIN users   u ON u.id = le.user_id
    JOIN books   b ON b.id = le.book_id
    JOIN authors a ON a.id = b.author_id
    WHERE u.share_token = p_token
      -- Kept, deliberately. Unlisted is not the same as unreserved.
      AND NOT le.is_hidden
      AND (p_status IS NULL OR le.status = p_status)
      AND (NOT p_favorites_only OR le.is_favorite)
      AND (
          p_query IS NULL
          OR b.title ILIKE '%' || p_query || '%'
          OR a.name  ILIKE '%' || p_query || '%'
      )
      AND (
          p_subject IS NULL
          OR EXISTS (SELECT 1 FROM unnest(b.subjects) x WHERE LOWER(x) = LOWER(p_subject))
      )
    ORDER BY le.date_added DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
