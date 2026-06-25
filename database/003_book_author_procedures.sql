-- BookHunt stored procedures: book and author operations

BEGIN;

--------------------------------------------------------------------------------
-- 1. sp_upsert_book_from_google
--    Upsert an author by name (slug derived from name), then upsert a book by
--    google_books_id. Returns the full book row. Handles slug uniqueness by
--    appending a numeric suffix when conflicts arise.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_upsert_book_from_google(
    p_google_books_id VARCHAR,
    p_slug            VARCHAR,
    p_title           VARCHAR,
    p_author_name     VARCHAR,
    p_year            INT,
    p_publisher       VARCHAR,
    p_pages           INT,
    p_rating          NUMERIC,
    p_subjects        TEXT[],
    p_blurb           TEXT,
    p_cover_url       VARCHAR,
    p_isbn13          VARCHAR,
    p_language        VARCHAR,
    p_hue             VARCHAR
) RETURNS SETOF books
LANGUAGE plpgsql AS $$
DECLARE
    v_author_id     INT;
    v_author_slug   VARCHAR;
    v_book_slug     VARCHAR;
    v_book_id       INT;
    v_suffix        INT;
BEGIN
    -- Generate author slug: lowercase, replace non-alphanumeric runs with hyphens,
    -- trim leading/trailing hyphens.
    v_author_slug := TRIM(BOTH '-' FROM
        REGEXP_REPLACE(LOWER(p_author_name), '[^a-z0-9]+', '-', 'g')
    );

    -- Upsert author by name (case-insensitive match).
    INSERT INTO authors (slug, name)
    VALUES (v_author_slug, p_author_name)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_author_id;

    -- If the upsert matched on slug but the name differs (different author,
    -- same slug), we already got the id above. That is acceptable: the slug
    -- owner keeps the row.
    IF v_author_id IS NULL THEN
        SELECT id INTO v_author_id
        FROM authors
        WHERE slug = v_author_slug;
    END IF;

    -- Resolve book slug uniqueness: try p_slug, then p_slug-2, p_slug-3, etc.
    v_book_slug := p_slug;
    v_suffix := 2;

    -- Only enforce uniqueness when inserting a NEW book (i.e., when there is no
    -- existing book with this google_books_id that already owns the slug).
    WHILE EXISTS (
        SELECT 1 FROM books
        WHERE slug = v_book_slug
          AND (google_books_id IS DISTINCT FROM p_google_books_id)
    ) LOOP
        v_book_slug := p_slug || '-' || v_suffix;
        v_suffix := v_suffix + 1;
    END LOOP;

    -- Upsert book by google_books_id.
    INSERT INTO books (
        google_books_id, slug, title, author_id, year, publisher, pages,
        rating, subjects, blurb, cover_url, isbn13, language, hue
    ) VALUES (
        p_google_books_id, v_book_slug, p_title, v_author_id, p_year,
        p_publisher, p_pages, p_rating, COALESCE(p_subjects, '{}'),
        COALESCE(p_blurb, ''), p_cover_url, p_isbn13,
        COALESCE(p_language, 'English'), COALESCE(p_hue, '#6f7a55')
    )
    ON CONFLICT (google_books_id) DO UPDATE SET
        slug      = EXCLUDED.slug,
        title     = EXCLUDED.title,
        author_id = EXCLUDED.author_id,
        year      = EXCLUDED.year,
        publisher = EXCLUDED.publisher,
        pages     = EXCLUDED.pages,
        rating    = EXCLUDED.rating,
        subjects  = EXCLUDED.subjects,
        blurb     = EXCLUDED.blurb,
        cover_url = EXCLUDED.cover_url,
        isbn13    = EXCLUDED.isbn13,
        language  = EXCLUDED.language,
        hue       = EXCLUDED.hue
    RETURNING id INTO v_book_id;

    RETURN QUERY SELECT * FROM books WHERE id = v_book_id;
END;
$$;

--------------------------------------------------------------------------------
-- 2. sp_get_book_by_slug
--    Return book joined with author name and author slug. NULL if not found.
--------------------------------------------------------------------------------
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

--------------------------------------------------------------------------------
-- 3. sp_get_book_by_google_id
--    Return book row by google_books_id, or NULL if not found.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_book_by_google_id(
    p_google_books_id VARCHAR
) RETURNS SETOF books
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM books WHERE google_books_id = p_google_books_id;
END;
$$;

--------------------------------------------------------------------------------
-- 4. sp_get_author_by_slug
--    Return author row by slug, or NULL if not found.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_author_by_slug(
    p_slug VARCHAR
) RETURNS SETOF authors
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM authors WHERE slug = p_slug;
END;
$$;

--------------------------------------------------------------------------------
-- 5. sp_get_books_by_author
--    Return books by author, optionally excluding one book, sorted by rating
--    DESC NULLS LAST then title ASC, limited to p_limit rows.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_books_by_author(
    p_author_id      INT,
    p_exclude_book_id INT DEFAULT NULL,
    p_limit          INT DEFAULT 10
) RETURNS SETOF books
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM books
    WHERE author_id = p_author_id
      AND (p_exclude_book_id IS NULL OR id <> p_exclude_book_id)
    ORDER BY rating DESC NULLS LAST, title ASC
    LIMIT p_limit;
END;
$$;

--------------------------------------------------------------------------------
-- 6. sp_get_related_books
--    Return related books for a given book. First pulls explicit related book
--    ids from the books.related array, then fills remaining slots with books
--    sharing the most subjects (subject-overlap fallback), up to p_limit total.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_related_books(
    p_book_id INT,
    p_limit   INT DEFAULT 6
) RETURNS SETOF books
LANGUAGE plpgsql AS $$
DECLARE
    v_explicit_ids  INT[];
    v_explicit_count INT;
    v_remaining     INT;
    v_subjects      TEXT[];
BEGIN
    -- Fetch the explicit related ids and the book's subjects.
    SELECT b.related, b.subjects
    INTO v_explicit_ids, v_subjects
    FROM books b
    WHERE b.id = p_book_id;

    -- Sanitise: if NULL, treat as empty.
    v_explicit_ids := COALESCE(v_explicit_ids, '{}');
    v_subjects     := COALESCE(v_subjects, '{}');

    -- Count how many explicit related books actually exist (cap at p_limit).
    SELECT COUNT(*)::INT INTO v_explicit_count
    FROM books
    WHERE id = ANY(v_explicit_ids);

    v_explicit_count := LEAST(v_explicit_count, p_limit);
    v_remaining      := p_limit - v_explicit_count;

    -- Return explicit related books first (preserve array order), then fallback.
    RETURN QUERY
    (
        -- Explicit related books, ordered by their position in the array.
        SELECT b.*
        FROM unnest(v_explicit_ids) WITH ORDINALITY AS r(rid, ord)
        JOIN books b ON b.id = r.rid
        ORDER BY r.ord
        LIMIT v_explicit_count
    )
    UNION ALL
    (
        -- Subject-overlap fallback: books sharing the most subjects with p_book_id,
        -- excluding the source book and any explicit related books.
        SELECT b.*
        FROM books b
        WHERE b.id <> p_book_id
          AND NOT (b.id = ANY(v_explicit_ids))
          AND v_remaining > 0
          AND cardinality(v_subjects) > 0
          AND b.subjects && v_subjects
        ORDER BY cardinality(ARRAY(
            SELECT unnest(b.subjects) INTERSECT SELECT unnest(v_subjects)
        )) DESC,
        b.rating DESC NULLS LAST
        LIMIT v_remaining
    );
END;
$$;

--------------------------------------------------------------------------------
-- 7. sp_update_book_ai_metadata
--    Update genres and themes on a book row.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_update_book_ai_metadata(
    p_book_id INT,
    p_genres  TEXT[],
    p_themes  TEXT[]
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE books
    SET genres = COALESCE(p_genres, '{}'),
        themes = COALESCE(p_themes, '{}')
    WHERE id = p_book_id;
END;
$$;

COMMIT;
