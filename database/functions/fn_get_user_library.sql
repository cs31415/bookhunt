-- Return all library entries for a user joined with book + author data.
-- Ordered by date_added DESC.
CREATE OR REPLACE FUNCTION fn_get_user_library(
    p_user_id INT
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    notes        TEXT,
    user_related INT[],
    title        VARCHAR,
    book_slug    VARCHAR,
    author_name  VARCHAR,
    author_slug  VARCHAR,
    year         INT,
    pages        INT,
    rating       NUMERIC,
    subjects     TEXT[],
    cover_url    VARCHAR,
    hue          VARCHAR
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
        le.notes,
        le.user_related,
        b.title,
        b.slug    AS book_slug,
        a.name    AS author_name,
        a.slug    AS author_slug,
        b.year,
        b.pages,
        b.rating,
        b.subjects,
        b.cover_url,
        b.hue
    FROM library_entries le
    JOIN books   b ON b.id = le.book_id
    JOIN authors a ON a.id = b.author_id
    WHERE le.user_id = p_user_id
    ORDER BY le.date_added DESC;
END;
$$;
