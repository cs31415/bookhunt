-- Add LLM-generated categories to a book's subjects without losing what the
-- provider supplied.
--
-- Append rather than replace: books.subjects is read by catalog search,
-- recommendations, related-books and the search facets, so overwriting it
-- would quietly change all four. The provider's tags stay, the model's join
-- them, and the library's pills tell the two apart on their own -- a granular
-- provider heading lands on one book and is culled, a category the model chose
-- to be broad lands on many and rises.
--
-- Deduped case-insensitively so 'Popular science' does not sit beside
-- 'Popular Science'. The stored spelling wins, since it is what the vocabulary
-- already offers back to the model.
CREATE OR REPLACE FUNCTION fn_append_book_subjects(
    p_book_id  INT,
    p_subjects TEXT[]
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE books b
    SET subjects = (
        SELECT array_agg(s ORDER BY ord)
        FROM (
            SELECT DISTINCT ON (lower(s)) s, ord
            FROM (
                -- Existing first, so DISTINCT ON keeps the stored spelling
                -- when the model returns a differently-cased duplicate.
                SELECT unnest(COALESCE(b.subjects, '{}')) AS s,
                       generate_series(1, COALESCE(array_length(b.subjects, 1), 0)) AS ord
                UNION ALL
                SELECT unnest(COALESCE(p_subjects, '{}')),
                       COALESCE(array_length(b.subjects, 1), 0)
                         + generate_series(1, COALESCE(array_length(p_subjects, 1), 0))
            ) all_subjects
            WHERE s IS NOT NULL AND btrim(s) <> ''
            ORDER BY lower(s), ord
        ) deduped
    )
    WHERE b.id = p_book_id;
END;
$$;
