-- Return related books for a given book. First pulls explicit related book
-- ids from the books.related array, then fills remaining slots with books
-- sharing the most subjects (subject-overlap fallback), up to p_limit total.
CREATE OR REPLACE FUNCTION fn_get_related_books(
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
