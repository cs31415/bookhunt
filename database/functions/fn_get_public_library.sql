-- A reader's library as a visitor sees it, addressed by handle.
--
-- Three things separate this from fn_get_user_library, and all three are the
-- point of the function:
--
--   1. It returns nothing unless is_discoverable is true. The gate lives in the
--      WHERE clause rather than in a caller, so no future route can forget it.
--   2. It always excludes hidden entries.
--   3. review is returned only when it has been published, and the gate is in
--      the SELECT rather than in a caller -- the same shape as the
--      is_discoverable gate above it, so no route written later can bypass it.
--
--      This is a trade, and worth stating (LOS-266). Until now the guarantee
--      was structural: review was not in the row type at all, so no endpoint
--      could leak it however badly written. It is now a SQL-level gate --
--      single-place and enforced for every caller, but no longer impossible by
--      construction. Worth paying only because every read goes through this one
--      expression.
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
DROP FUNCTION IF EXISTS fn_get_public_library(VARCHAR, reading_status, BOOLEAN, INT, INT, TEXT, TEXT);
-- And the nine-argument one, whose row type gains `review` (LOS-266).
DROP FUNCTION IF EXISTS fn_get_public_library(VARCHAR, reading_status, BOOLEAN, INT, INT, TEXT, TEXT, TEXT, TEXT);
-- And the ten-argument one, which gains p_book_id (LOS-360).
DROP FUNCTION IF EXISTS fn_get_public_library(VARCHAR, reading_status, BOOLEAN, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);
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
    p_subject        TEXT           DEFAULT NULL,
    -- Mood and theme, matched the same whole-value way as p_subject. The rows
    -- already carry both arrays; until now only the caller could filter on
    -- them, and only over the page it happened to be holding.
    p_mood           TEXT           DEFAULT NULL,
    p_theme          TEXT           DEFAULT NULL,
    -- One book rather than a page of them (LOS-360), for showing a reader's own
    -- entry for a book a visitor arrived at from their shelf.
    --
    -- A parameter here rather than a second function on purpose: the sharing
    -- gate in the SELECT is the thing that must never be got wrong, and a
    -- second query would be a second place for it to drift out of step.
    p_book_id        INT            DEFAULT NULL
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
    -- NULL where the reader has not published this one, which is the same thing
    -- a visitor sees for a book with no review at all.
    review       TEXT,
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
        -- The per-book override wins in both directions; NULL falls through to
        -- the reader's global setting, which is FALSE unless they changed it.
        CASE WHEN COALESCE(le.share_review, u.share_reviews) THEN le.review ELSE NULL END AS review,
        COUNT(*) OVER ()::BIGINT AS total_count
    FROM library_entries le
    JOIN users   u ON u.id = le.user_id
    JOIN books   b ON b.id = le.book_id
    JOIN authors a ON a.id = b.author_id
    WHERE LOWER(u.handle) = LOWER(p_handle)
      AND u.is_discoverable
      AND NOT le.is_hidden
      AND (p_book_id IS NULL OR le.book_id = p_book_id)
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
      AND (
          p_mood IS NULL
          OR EXISTS (SELECT 1 FROM unnest(b.moods) x WHERE LOWER(x) = LOWER(p_mood))
      )
      AND (
          p_theme IS NULL
          OR EXISTS (SELECT 1 FROM unnest(b.themes) x WHERE LOWER(x) = LOWER(p_theme))
      )
    ORDER BY le.date_added DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
