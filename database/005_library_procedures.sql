-- BookHunt stored procedures: library operations

BEGIN;

--------------------------------------------------------------------------------
-- 1. sp_get_user_library
--    Return all library entries for a user joined with book + author data.
--    Ordered by date_added DESC.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_get_user_library(
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

--------------------------------------------------------------------------------
-- 2. sp_add_to_library
--    Insert a library entry. ON CONFLICT DO NOTHING to avoid duplicates.
--    Returns the entry row (existing or newly created).
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_add_to_library(
    p_user_id INT,
    p_book_id INT,
    p_status  reading_status DEFAULT 'queued'
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    notes        TEXT,
    user_related INT[]
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO library_entries (user_id, book_id, status)
    VALUES (p_user_id, p_book_id, p_status)
    ON CONFLICT (user_id, book_id) DO NOTHING;

    RETURN QUERY
    SELECT le.user_id, le.book_id, le.status, le.date_added, le.date_read,
           le.user_rating, le.review, le.notes, le.user_related
    FROM library_entries le
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id;
END;
$$;

--------------------------------------------------------------------------------
-- 3. sp_update_library_entry
--    Update only the fields that are not NULL (COALESCE with existing values).
--    If status changes to 'finished', set date_read = NOW().
--    Returns nothing if entry does not exist.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_update_library_entry(
    p_user_id     INT,
    p_book_id     INT,
    p_status      reading_status DEFAULT NULL,
    p_user_rating INT DEFAULT NULL,
    p_notes       TEXT DEFAULT NULL,
    p_review      TEXT DEFAULT NULL
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    notes        TEXT,
    user_related INT[]
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE library_entries le
    SET status      = COALESCE(p_status, le.status),
        user_rating = COALESCE(p_user_rating, le.user_rating),
        notes       = COALESCE(p_notes, le.notes),
        review      = COALESCE(p_review, le.review),
        date_read   = CASE
                        WHEN p_status = 'finished' AND le.status <> 'finished'
                            THEN NOW()
                        ELSE le.date_read
                      END
    WHERE le.user_id = p_user_id AND le.book_id = p_book_id
    RETURNING le.user_id, le.book_id, le.status, le.date_added, le.date_read,
              le.user_rating, le.review, le.notes, le.user_related;
END;
$$;

--------------------------------------------------------------------------------
-- 4. sp_remove_from_library
--    Delete a library entry. Return boolean via FOUND.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_remove_from_library(
    p_user_id INT,
    p_book_id INT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM library_entries
    WHERE user_id = p_user_id AND book_id = p_book_id;

    RETURN FOUND;
END;
$$;

--------------------------------------------------------------------------------
-- 5. sp_library_stats
--    Return a JSON object with total count, counts by status, top subjects
--    (with counts), and top authors (with counts).
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_library_stats(
    p_user_id INT
) RETURNS JSON
LANGUAGE plpgsql AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total', (
            SELECT COUNT(*)
            FROM library_entries
            WHERE user_id = p_user_id
        ),
        'by_status', (
            SELECT COALESCE(json_object_agg(s.status, s.cnt), '{}')
            FROM (
                SELECT le.status, COUNT(*) AS cnt
                FROM library_entries le
                WHERE le.user_id = p_user_id
                GROUP BY le.status
            ) s
        ),
        'top_subjects', (
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
            FROM (
                SELECT subj AS subject, COUNT(*) AS cnt
                FROM library_entries le
                JOIN books b ON b.id = le.book_id,
                     unnest(b.subjects) AS subj
                WHERE le.user_id = p_user_id
                GROUP BY subj
                ORDER BY cnt DESC, subj ASC
                LIMIT 10
            ) t
        ),
        'top_authors', (
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
            FROM (
                SELECT a.name AS author, COUNT(*) AS cnt
                FROM library_entries le
                JOIN books   b ON b.id = le.book_id
                JOIN authors a ON a.id = b.author_id
                WHERE le.user_id = p_user_id
                GROUP BY a.name
                ORDER BY cnt DESC, a.name ASC
                LIMIT 10
            ) t
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

--------------------------------------------------------------------------------
-- 6. sp_add_user_related
--    Append a related book to the user_related array on a library entry.
--    Rejects if p_related_book_id = p_book_id.
--    Only appends if not already present. Returns the updated array.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_add_user_related(
    p_user_id        INT,
    p_book_id        INT,
    p_related_book_id INT
) RETURNS INT[]
LANGUAGE plpgsql AS $$
DECLARE
    v_result INT[];
BEGIN
    IF p_related_book_id = p_book_id THEN
        RAISE EXCEPTION 'A book cannot be related to itself';
    END IF;

    UPDATE library_entries
    SET user_related = CASE
        WHEN NOT (p_related_book_id = ANY(COALESCE(user_related, '{}')))
            THEN array_append(COALESCE(user_related, '{}'), p_related_book_id)
        ELSE user_related
    END
    WHERE user_id = p_user_id AND book_id = p_book_id
    RETURNING user_related INTO v_result;

    RETURN v_result;
END;
$$;

--------------------------------------------------------------------------------
-- 7. sp_remove_user_related
--    Remove a related book from the user_related array. Returns the updated array.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_remove_user_related(
    p_user_id        INT,
    p_book_id        INT,
    p_related_book_id INT
) RETURNS INT[]
LANGUAGE plpgsql AS $$
DECLARE
    v_result INT[];
BEGIN
    UPDATE library_entries
    SET user_related = array_remove(COALESCE(user_related, '{}'), p_related_book_id)
    WHERE user_id = p_user_id AND book_id = p_book_id
    RETURNING user_related INTO v_result;

    RETURN v_result;
END;
$$;

COMMIT;
