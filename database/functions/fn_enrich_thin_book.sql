-- Fill in a book that was created from a title and an author alone, once a
-- provider has been found for it (LOS-196).
--
-- Deliberately not fn_upsert_book. That matches on google_books_id or
-- openlibrary_id, and a thin row has neither -- so it takes the INSERT branch,
-- hits the unique slug, and stores a *second* book under a suffixed slug while
-- the thin row it was meant to fix sits untouched with the library entry still
-- pointing at it. This updates the row by id instead.
--
-- COALESCE keeps whatever the row already had: the reader typed that title and
-- author off their own shelf, and the provider match came from a fuzzy title
-- search that can easily land on a different edition.
--
-- Returns TRUE when the row was enriched. FALSE means another book already
-- holds that provider id -- the catalog has the book properly and this thin row
-- is a duplicate of it. Merging the two is a bigger job than this; the caller
-- treats it as a miss and leaves the row alone.
CREATE OR REPLACE FUNCTION fn_enrich_thin_book(
    p_book_id         INT,
    p_google_books_id VARCHAR,
    p_openlibrary_id  VARCHAR,
    p_year            INT,
    p_publisher       VARCHAR,
    p_pages           INT,
    p_rating          NUMERIC,
    p_subjects        TEXT[],
    p_blurb           TEXT,
    p_cover_url       VARCHAR,
    p_isbn13          VARCHAR,
    p_language        VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM books
        WHERE id <> p_book_id
          AND ((p_google_books_id IS NOT NULL AND google_books_id = p_google_books_id)
            OR (p_openlibrary_id  IS NOT NULL AND openlibrary_id  = p_openlibrary_id))
    ) THEN
        RETURN FALSE;
    END IF;

    UPDATE books SET
        google_books_id = COALESCE(google_books_id, p_google_books_id),
        openlibrary_id  = COALESCE(openlibrary_id,  p_openlibrary_id),
        year            = COALESCE(year,            p_year),
        publisher       = COALESCE(publisher,       p_publisher),
        pages           = COALESCE(pages,           p_pages),
        rating          = COALESCE(rating,          p_rating),
        subjects        = CASE
                              WHEN COALESCE(array_length(subjects, 1), 0) = 0
                              THEN COALESCE(p_subjects, '{}')
                              ELSE subjects
                          END,
        blurb           = COALESCE(blurb,           p_blurb),
        cover_url       = COALESCE(cover_url,       p_cover_url),
        isbn13          = COALESCE(isbn13,          p_isbn13),
        language        = COALESCE(language,        p_language)
    WHERE id = p_book_id;

    RETURN TRUE;
END;
$$;
