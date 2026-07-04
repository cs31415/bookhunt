-- Return book joined with author name and author slug. NULL if not found.
CREATE OR REPLACE FUNCTION sp_get_book_by_slug(
    p_slug VARCHAR
) RETURNS TABLE (
    id              INT,
    slug            VARCHAR,
    title           VARCHAR,
    author_id       INT,
    year            INT,
    publisher       VARCHAR,
    pages           INT,
    rating          NUMERIC,
    subjects        TEXT[],
    moods           TEXT[],
    genres          TEXT[],
    themes          TEXT[],
    hue             VARCHAR,
    blurb           TEXT,
    cover_url       VARCHAR,
    google_books_id VARCHAR,
    isbn13          VARCHAR,
    language        VARCHAR,
    related         INT[],
    author_name     VARCHAR,
    author_slug     VARCHAR
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.slug,
        b.title,
        b.author_id,
        b.year,
        b.publisher,
        b.pages,
        b.rating,
        b.subjects,
        b.moods,
        b.genres,
        b.themes,
        b.hue,
        b.blurb,
        b.cover_url,
        b.google_books_id,
        b.isbn13,
        b.language,
        b.related,
        a.name  AS author_name,
        a.slug  AS author_slug
    FROM books b
    JOIN authors a ON a.id = b.author_id
    WHERE b.slug = p_slug;
END;
$$;
