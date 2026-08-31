-- Return library entries for a user joined with book + author data, paginated.
-- Ordered by date_added DESC. Returns a window total_count for pagination.
-- DROP is required because adding a column changes the RETURNS TABLE row
-- type, which CREATE OR REPLACE cannot do in place.
DROP FUNCTION IF EXISTS fn_get_user_library(INT);
DROP FUNCTION IF EXISTS fn_get_user_library(INT, INT, INT);
-- The row type loses `notes`, which LOS-266 folded into `review`. Changing a
-- RETURNS TABLE changes the return type, and CREATE OR REPLACE cannot do that,
-- so the old signature has to go first.
DROP FUNCTION IF EXISTS fn_get_user_library(INT, INT, INT);

CREATE OR REPLACE FUNCTION fn_get_user_library(
    p_user_id INT,
    p_limit   INT DEFAULT 24,
    p_offset  INT DEFAULT 0
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    user_related INT[],
    is_favorite  BOOLEAN,
    is_hidden    BOOLEAN,
    is_ebook     BOOLEAN,
    is_audiobook BOOLEAN,
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
        le.user_id,
        le.book_id,
        le.status,
        le.date_added,
        le.date_read,
        le.user_rating,
        le.review,
        le.user_related,
        le.is_favorite,
        le.is_hidden,
        le.is_ebook,
        le.is_audiobook,
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
    JOIN books   b ON b.id = le.book_id
    JOIN authors a ON a.id = b.author_id
    WHERE le.user_id = p_user_id
    ORDER BY le.date_added DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
