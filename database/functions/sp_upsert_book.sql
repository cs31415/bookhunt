-- Upsert an author by name (slug derived from name), then upsert a book by
-- google_books_id (if present) or openlibrary_id (if present). Returns the
-- full book row. Handles slug uniqueness by appending a numeric suffix when
-- conflicts arise.
CREATE OR REPLACE FUNCTION sp_upsert_book(
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
    p_hue             VARCHAR,
    p_openlibrary_id  VARCHAR,
    p_source          VARCHAR
) RETURNS SETOF books
LANGUAGE plpgsql AS $$
DECLARE
    v_author_id     INT;
    v_author_slug   VARCHAR;
    v_book_slug     VARCHAR;
    v_book_id       INT;
    v_suffix        INT;
    v_source        VARCHAR := COALESCE(p_source, 'google_books');
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
    -- existing book with this same external id that already owns the slug).
    -- Whichever external id is authoritative for this row (google_books_id if
    -- present, else openlibrary_id) is used to identify "this same book".
    WHILE EXISTS (
        SELECT 1 FROM books
        WHERE slug = v_book_slug
          AND (
            (p_google_books_id IS NOT NULL AND google_books_id IS DISTINCT FROM p_google_books_id)
            OR (p_google_books_id IS NULL AND (p_openlibrary_id IS NULL OR openlibrary_id IS DISTINCT FROM p_openlibrary_id))
          )
    ) LOOP
        v_book_slug := p_slug || '-' || v_suffix;
        v_suffix := v_suffix + 1;
    END LOOP;

    IF p_google_books_id IS NOT NULL THEN
        INSERT INTO books (
            google_books_id, openlibrary_id, source, slug, title, author_id, year, publisher, pages,
            rating, subjects, blurb, cover_url, isbn13, language, hue
        ) VALUES (
            p_google_books_id, p_openlibrary_id, v_source, v_book_slug, p_title, v_author_id, p_year,
            p_publisher, p_pages, p_rating, COALESCE(p_subjects, '{}'),
            COALESCE(p_blurb, ''), p_cover_url, p_isbn13,
            COALESCE(p_language, 'English'), COALESCE(p_hue, '#6f7a55')
        )
        ON CONFLICT (google_books_id) DO UPDATE SET
            openlibrary_id = EXCLUDED.openlibrary_id,
            source         = EXCLUDED.source,
            slug           = EXCLUDED.slug,
            title          = EXCLUDED.title,
            author_id      = EXCLUDED.author_id,
            year           = EXCLUDED.year,
            publisher      = EXCLUDED.publisher,
            pages          = EXCLUDED.pages,
            rating         = EXCLUDED.rating,
            subjects       = EXCLUDED.subjects,
            blurb          = EXCLUDED.blurb,
            cover_url      = EXCLUDED.cover_url,
            isbn13         = EXCLUDED.isbn13,
            language       = EXCLUDED.language,
            hue            = EXCLUDED.hue
        RETURNING id INTO v_book_id;
    ELSIF p_openlibrary_id IS NOT NULL THEN
        INSERT INTO books (
            google_books_id, openlibrary_id, source, slug, title, author_id, year, publisher, pages,
            rating, subjects, blurb, cover_url, isbn13, language, hue
        ) VALUES (
            p_google_books_id, p_openlibrary_id, v_source, v_book_slug, p_title, v_author_id, p_year,
            p_publisher, p_pages, p_rating, COALESCE(p_subjects, '{}'),
            COALESCE(p_blurb, ''), p_cover_url, p_isbn13,
            COALESCE(p_language, 'English'), COALESCE(p_hue, '#6f7a55')
        )
        ON CONFLICT (openlibrary_id) DO UPDATE SET
            google_books_id = EXCLUDED.google_books_id,
            source          = EXCLUDED.source,
            slug            = EXCLUDED.slug,
            title           = EXCLUDED.title,
            author_id       = EXCLUDED.author_id,
            year            = EXCLUDED.year,
            publisher       = EXCLUDED.publisher,
            pages           = EXCLUDED.pages,
            rating          = EXCLUDED.rating,
            subjects        = EXCLUDED.subjects,
            blurb           = EXCLUDED.blurb,
            cover_url       = EXCLUDED.cover_url,
            isbn13          = EXCLUDED.isbn13,
            language        = EXCLUDED.language,
            hue             = EXCLUDED.hue
        RETURNING id INTO v_book_id;
    ELSE
        INSERT INTO books (
            google_books_id, openlibrary_id, source, slug, title, author_id, year, publisher, pages,
            rating, subjects, blurb, cover_url, isbn13, language, hue
        ) VALUES (
            p_google_books_id, p_openlibrary_id, v_source, v_book_slug, p_title, v_author_id, p_year,
            p_publisher, p_pages, p_rating, COALESCE(p_subjects, '{}'),
            COALESCE(p_blurb, ''), p_cover_url, p_isbn13,
            COALESCE(p_language, 'English'), COALESCE(p_hue, '#6f7a55')
        )
        RETURNING id INTO v_book_id;
    END IF;

    RETURN QUERY SELECT * FROM books WHERE id = v_book_id;
END;
$$;
