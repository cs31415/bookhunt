-- A reader's library as a visitor sees it, addressed by handle.
--
-- Three things separate this from fn_get_user_library, and all three are the
-- point of the function:
--
--   1. It returns nothing unless is_discoverable is true. The gate lives in the
--      WHERE clause rather than in a caller, so no future route can forget it.
--   2. It always excludes hidden entries.
--   3. notes and review are absent from the row type entirely. Leaving them out
--      of the shape, rather than trusting every caller to drop them, is what
--      makes it impossible to leak a private note through a new endpoint.
--
-- One function with filters rather than three near-identical ones: the library,
-- currently-reading and favourites tabs differ only by p_status and
-- p_favorites_only, and as of LOS-304 the search box and the category pills are
-- two more filters on the same query rather than a route of their own.
--
-- Adding parameters changes the overload set, so the old signature has to go
-- before this one is created -- the same reason fn_get_user_library carries its
-- own DROPs.
DROP FUNCTION IF EXISTS fn_get_public_library(VARCHAR, reading_status, BOOLEAN, INT, INT);
CREATE OR REPLACE FUNCTION fn_get_public_library(
    p_handle         VARCHAR,
    p_status         reading_status DEFAULT NULL,
    p_favorites_only BOOLEAN        DEFAULT FALSE,
    p_limit          INT            DEFAULT 24,
    p_offset         INT            DEFAULT 0,
    -- Matches title or author. NULL means no search, which is not the same as
    -- an empty string: the caller trims and passes NULL rather than '%%'.
    p_query          TEXT           DEFAULT NULL,
    -- One category, as clicked on a pill. Compared case-insensitively but
    -- whole: a pill carries the exact subject, so a substring match would let
    -- "Fiction" pull in "Science Fiction".
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
    WHERE LOWER(u.handle) = LOWER(p_handle)
      AND u.is_discoverable
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
