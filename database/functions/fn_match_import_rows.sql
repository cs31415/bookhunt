-- Match a batch of imported rows against the catalog in one pass.
--
-- fn_search_books answers the same question one title at a time, which cost an
-- import a query per row -- 372 of them on a real file. This takes the whole
-- batch: p_terms and p_phrases are parallel arrays, one entry per row, and the
-- result carries row_index so the caller can put each book back with its row.
--
-- Deliberately narrower than fn_search_books, because the import path re-ranks
-- what comes back with its own scoring and only ever reads these columns:
--   * scores title and author only, skipping the subjects/moods/genres/themes/
--     blurb haystack that function builds per book per term. A book matching on
--     blurb alone cannot clear the import's title threshold anyway.
--   * no total_count window, no facet filters, no sort modes.
--
-- Terms arrive already tokenised and lowercased (tokenizeQuery), so stop words
-- are defined in one place rather than reimplemented here.
CREATE OR REPLACE FUNCTION fn_match_import_rows(
    p_terms   TEXT[],            -- one space-joined token string per row
    p_phrases TEXT[],            -- the full lowercased title per row, same order
    p_user_id INT  DEFAULT NULL,
    p_limit   INT  DEFAULT 5     -- candidates per row
) RETURNS TABLE (
    row_index   INT,
    book_id     INT,
    slug        VARCHAR,
    title       VARCHAR,
    author_name VARCHAR,
    author_slug VARCHAR,
    year        INT,
    rating      NUMERIC,
    cover_url   VARCHAR,
    hue         VARCHAR,
    publisher   VARCHAR,
    isbn13      VARCHAR,
    in_library  BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        (q.ord - 1)::INT AS row_index,
        m.book_id, m.slug, m.title, m.author_name, m.author_slug,
        m.year, m.rating, m.cover_url, m.hue, m.publisher, m.isbn13, m.in_library
    FROM unnest(p_terms, p_phrases) WITH ORDINALITY AS q(terms, phrase, ord)
    CROSS JOIN LATERAL (
        SELECT * FROM (
            SELECT
                b.id            AS book_id,
                b.slug,
                b.title,
                a.name          AS author_name,
                a.slug          AS author_slug,
                b.year,
                b.rating,
                b.cover_url,
                b.hue,
                b.publisher,
                b.isbn13,
                (le.status IS NOT NULL) AS in_library,
                (
                    COALESCE((
                        SELECT SUM(
                            CASE WHEN b.title ILIKE '%' || t || '%' THEN 6 ELSE 0 END +
                            CASE WHEN a.name  ILIKE '%' || t || '%' THEN 5 ELSE 0 END
                        )
                        FROM unnest(string_to_array(q.terms, ' ')) AS t
                    ), 0)
                    +
                    CASE WHEN LENGTH(q.phrase) > 3 AND b.title ILIKE '%' || q.phrase || '%'
                         THEN 4 ELSE 0 END
                )::NUMERIC AS relevance
            FROM books b
            JOIN authors a ON a.id = b.author_id
            LEFT JOIN library_entries le ON le.book_id = b.id AND le.user_id = p_user_id
        ) scored
        WHERE scored.relevance > 0
        ORDER BY scored.relevance DESC, scored.rating DESC NULLS LAST, scored.book_id ASC
        LIMIT p_limit
    ) m;
END;
$$;
