-- A reader's whole library, as a file they can take away (LOS-302).
--
-- Its own function rather than a filter on fn_get_user_library, because the two
-- want different columns. The shelf needs covers, hues, ratings and tags to
-- draw a card; an export needs publisher and isbn13, which the shelf function
-- does not return at all -- and those, with the format flags, are exactly what
-- makes an exported file re-importable.
--
-- No visibility gate of any kind. This is the owner reading their own rows, so
-- hidden entries are included: a backup that silently dropped the books a
-- reader chose to keep off their public page would not be a backup.
--
-- Paginated so the caller can walk it without holding a whole library in one
-- result set. total_count comes back on every row, as it does elsewhere.
-- DROP is required, not tidy. The return type gains is_ebook and is_audiobook
-- (LOS-347), and CREATE OR REPLACE cannot change the row type defined by OUT
-- parameters -- Postgres refuses with "cannot change return type of existing
-- function" and, under ON_ERROR_STOP, takes the rest of setup_functions.sql
-- down with it.
--
-- This opens a window, the same one fn_register_user and fn_add_to_library
-- open: between this drop and the API restarting, the running API calls a
-- function that does not exist and an export fails. Every other path is
-- untouched, and an export is a rare deliberate act rather than something a
-- page does on load -- but it is why the functions step is not a place to stop.
DROP FUNCTION IF EXISTS fn_export_library(INT, INT, INT);

CREATE OR REPLACE FUNCTION fn_export_library(
    p_user_id INT,
    p_limit   INT DEFAULT 500,
    p_offset  INT DEFAULT 0
) RETURNS TABLE (
    title        VARCHAR,
    author_name  VARCHAR,
    publisher    VARCHAR,
    isbn13       VARCHAR,
    status       reading_status,
    is_ebook     BOOLEAN,
    is_audiobook BOOLEAN,
    is_favorite  BOOLEAN,
    total_count  BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.title,
        a.name AS author_name,
        b.publisher,
        b.isbn13,
        le.status,
        -- What the reader owns. Without these an export drops which books are
        -- ebooks or audiobooks, so a round trip through the CSV importer --
        -- which reads a format column -- silently makes everything physical
        -- (LOS-347).
        le.is_ebook,
        le.is_audiobook,
        le.is_favorite,
        COUNT(*) OVER ()::BIGINT AS total_count
    FROM library_entries le
    JOIN books   b ON b.id = le.book_id
    JOIN authors a ON a.id = b.author_id
    WHERE le.user_id = p_user_id
    -- Stable across the pages the caller walks. date_added alone is not: two
    -- books added in the same transaction share a timestamp, and a tie broken
    -- differently between two pages would drop one row and repeat another.
    ORDER BY le.date_added DESC, le.book_id
    LIMIT p_limit OFFSET p_offset;
END;
$$;
