-- Batch-fetch book summaries by google_books_id, preserving the caller's requested order.
-- Ids that don't match any catalog book are silently omitted.
CREATE OR REPLACE FUNCTION fn_get_books_by_google_ids(
    p_google_ids TEXT[]
) RETURNS TABLE (
    book_id        INT,
    slug           VARCHAR,
    title          VARCHAR,
    author_name    VARCHAR,
    author_slug    VARCHAR,
    year           INT,
    rating         NUMERIC,
    cover_url      VARCHAR,
    hue            VARCHAR,
    google_books_id VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.slug,
        b.title,
        a.name AS author_name,
        a.slug AS author_slug,
        b.year,
        b.rating,
        b.cover_url,
        b.hue,
        b.google_books_id
    FROM unnest(p_google_ids) WITH ORDINALITY AS gids(google_id, ord)
    JOIN books b ON b.google_books_id = gids.google_id
    JOIN authors a ON a.id = b.author_id
    ORDER BY gids.ord;
END;
$$;
