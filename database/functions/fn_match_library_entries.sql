-- Match a batch of title/author pairs against one user's library in one pass.
--
-- The AI search path asks "which of these books does the caller already own?"
-- for up to 20 LLM suggestions at a time. Those suggestions carry no ids -- the
-- LLM returns a title and an author and nothing else -- so the question can only
-- be answered by text, and only in a batch, not a query per suggestion.
--
-- Same shape as fn_match_import_rows: p_terms and p_phrases are parallel arrays,
-- one entry per input book, and each result carries row_index so the caller can
-- put candidates back with their book. Terms arrive already tokenised and
-- lowercased (tokenizeQuery), so stop words stay defined in one place.
--
-- Differs from fn_match_import_rows in joining library_entries INNER: candidates
-- come from the caller's library rather than the whole catalog. Narrower and
-- more accurate -- the top candidates for a common title across the full catalog
-- need not include the copy this user owns. Ownership is the join itself, not
-- `status IS NOT NULL`, because library_entries.status is nullable and a row
-- with no status is still an owned book.
CREATE OR REPLACE FUNCTION fn_match_library_entries(
    p_user_id INT,
    p_terms   TEXT[],            -- one space-joined token string per input book
    p_phrases TEXT[],            -- the full lowercased title per book, same order
    p_limit   INT DEFAULT 5      -- candidates per book
) RETURNS TABLE (
    row_index   INT,
    book_id     INT,
    title       VARCHAR,
    author_name VARCHAR,
    isbn13      VARCHAR,
    status      reading_status
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        (q.ord - 1)::INT AS row_index,
        m.book_id, m.title, m.author_name, m.isbn13, m.status
    FROM unnest(p_terms, p_phrases) WITH ORDINALITY AS q(terms, phrase, ord)
    CROSS JOIN LATERAL (
        SELECT * FROM (
            SELECT
                b.id     AS book_id,
                b.title,
                a.name   AS author_name,
                b.isbn13,
                le.status,
                b.rating,
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
            FROM library_entries le
            JOIN books b   ON b.id = le.book_id
            JOIN authors a ON a.id = b.author_id
            WHERE le.user_id = p_user_id
        ) scored
        WHERE scored.relevance > 0
        ORDER BY scored.relevance DESC, scored.rating DESC NULLS LAST, scored.book_id ASC
        LIMIT p_limit
    ) m;
END;
$$;
