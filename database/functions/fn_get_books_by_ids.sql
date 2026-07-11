-- Batch-fetch book summaries by id, preserving the caller's requested order.
-- Ids that don't match any book are silently omitted.
CREATE OR REPLACE FUNCTION fn_get_books_by_ids(
    p_ids INT[]
) RETURNS TABLE (
    book_id     INT,
    slug        VARCHAR,
    title       VARCHAR,
    author_name VARCHAR,
    author_slug VARCHAR,
    year        INT,
    rating      NUMERIC,
    cover_url   VARCHAR,
    hue         VARCHAR
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
        b.hue
    FROM unnest(p_ids) WITH ORDINALITY AS ids(id, ord)
    JOIN books b ON b.id = ids.id
    JOIN authors a ON a.id = b.author_id
    ORDER BY ids.ord;
END;
$$;
